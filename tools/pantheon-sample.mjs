// inherency: instrument
// A sample of the pantheon at work (core/pantheon.js), with stand-in gods: one stock each, first acts of Fibonacci
// sizes drawn by the golden sequence, and every rule of the web applied as the design says. It measures, it doesn't
// decide: the real gods come in wave 1. The Measure's checks run at every breath's close, and at the end the whole
// sample is run back to its first tick from the wake alone.
//   node tools/pantheon-sample.mjs [--breaths 3000] [--json out.json]     (default: one day, the clock's own rung)
//
//   draws       drawOf(tick, purpose): one god a tick, so the tick is the god's stream
//   first act   on its tick a god acts with a draw under 1/phi: a record god gives (+) or takes (-) a size from
//               F(6) to F(15) (13 to 610) on any stock; a shear god moves its own stock either way
//   answers     the next god answers on the next tick with round(cause x psi), and only while that is smaller than
//               its cause (strictly contracting); a holder may only answer on its own stock: on another's it lets
//               its tick pass and the next god answers at psi^2
//   bounds      a stock lives in [0, room], room = 610 x phi = 987: the part that fits is written, the rest a debt to the writer's
//               opposite, booked on the pair's ledger and settled by the opposite at its slot, half a breath on
//   claims      each breath, five cells take claims from the gods that draw under 1/phi^2, each claim its god's
//               vector; resolved with the breath's lead, and resolved again in reverse order
//   the Measure at every close: every open debt is younger than half a breath, every entry was written by the god
//               whose tick it is. At the end: the stocks rebuilt from the wake, then the whole run undone
import fs from "node:fs";
import * as P from "../core/pantheon.js";
import { PHI, FIB, FIBS } from "../core/golden.js";
import { RUNGS } from "../core/clock.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const BREATHS = +arg("--breaths", RUNGS.day / P.BREATH), TICKS = BREATHS * P.BREATH, out = arg("--json", null);
const EIGHT = P.GODS.slice(0, P.BREATH), HALF = P.BREATH / 2;
const STOCK = { builder: "standing", grower: "timber", bounty: "fish", reaper: "taken", mover: "under way", toll: "lost", unmaker: "ruin", trader: "goods" };
const INIT = FIBS[14];   // every stock starts at 610
const PAIRS = EIGHT.slice(0, HALF), ledgerKey = (g) => P.BREATH + Math.min(g.slot, P.opposite(g).slot);   // keys 8-11: the four pairs' ledgers
const stock = EIGHT.map(() => INIT), ledger = PAIRS.map(() => 0);
const SIZES = FIBS.slice(6, 16);   // 13 .. 610
const ROOM = P.roomOf(INIT);   // 987, F(16)
const DRAW = { act: 1, size: 2, key: 3, sign: 4, claim: 8 };   // the claims take 8 + the cell

// the wake, grown as it fills
let cap = 1 << 16, view = P.wakeOf(cap), n = 0;
const write = (e) => { if (n === cap) { const v2 = P.wakeOf(cap * 2); new Uint8Array(v2.buffer).set(new Uint8Array(view.buffer)); view = v2; cap *= 2; } P.encodeEntry(view, n, e); return n++; };

const pending = new Map();   // tick -> [{ kind, ... }]
const later = (t, item) => { if (t >= TICKS) { tally.cutOff++; return; } (pending.get(t) ?? pending.set(t, []).get(t)).push(item); };
const tally = { outOfRoom: 0, first: 0, answers: 0, passes: 0, worstOverBound: -Infinity, debts: 0, settled: 0, cutOff: 0, claimsHeld: 0, claimsWon: {}, claimOrderFails: 0, lateDebts: 0, wrongTick: 0 };
const chains = new Map();   // first entry -> { d0, hops, at8 }
const openDebts = new Map();   // debt entry -> raised at t

/** Write an amount on a stock for god g at t (its own op), clamping at zero: a shortfall is a debt to its opposite. */
function apply(g, t, key, d, cause, root) {
  const { put, short } = key < P.BREATH ? P.fitWrite(stock[key], d, ROOM) : { put: d, short: 0 };
  const i = write({ t, slot: g.slot, op: g.op, key, d: put, cause, gate: 0 });
  if (key < P.BREATH) { stock[key] += put; if (stock[key] < 0 || stock[key] > ROOM) tally.outOfRoom++; }
  if (short) { const lk = ledgerKey(g), j = write({ t, slot: g.slot, op: g.op, key: lk, d: -short, cause: i, gate: 0 });   // the shortfall booked on the pair's ledger
    ledger[lk - P.BREATH] += -short; openDebts.set(j, t); tally.debts++; later(t + HALF, { kind: "settle", debt: j, lk, amount: -short, root }); }
  return { i, put };
}

const t0 = performance.now();
for (let t = 0; t < TICKS; t++) {
  const g = P.godAt(t);
  for (const it of pending.get(t) ?? []) {
    if (it.kind === "answer") {
      const c = chains.get(it.root); c.hops++;
      const over = Math.abs(it.d) - (Math.abs(P.reactionBound(c.d0, c.hops)) + P.SLACK); if (over > tally.worstOverBound) tally.worstOverBound = over;
      if (c.hops === P.BREATH) c.at8 = Math.abs(it.d) / c.d0;
      if (!P.mayWrite(g, it.key)) {   // a holder on another's stock: its tick passes, the next god answers at psi^2
        tally.passes++; const nd = P.answerOf(it.d); if (nd) later(t + 1, { ...it, d: nd }); continue; }
      const { i } = apply(g, t, it.key, it.d, it.cause, it.root); tally.answers++;
      const nd = P.answerOf(it.d); if (nd) later(t + 1, { kind: "answer", key: it.key, d: nd, cause: i, root: it.root });
    } else {   // a debt settled by the opposite: the pair's ledger closes
      write({ t, slot: g.slot, op: g.op, key: it.lk, d: -it.amount, cause: it.debt, gate: 0 }); ledger[it.lk - P.BREATH] -= it.amount; openDebts.delete(it.debt); tally.settled++;
    }
  }
  pending.delete(t);
  if (P.drawOf(t, DRAW.act) < 1 / PHI) {   // a first act
    const size = SIZES[Math.floor(P.drawOf(t, DRAW.size) * SIZES.length)], key = g.op === "record" ? Math.floor(P.drawOf(t, DRAW.key) * P.BREATH) : g.slot;
    const sign = g.op === "record" ? g.v[1] : P.drawOf(t, DRAW.sign) < 0.5 ? 1 : -1, d = sign * size;
    const { i } = apply(g, t, key, d, -1, null); tally.first++; chains.set(i, { d0: size, hops: 0, at8: null });
    const nd = P.answerOf(d); if (nd) later(t + 1, { kind: "answer", key, d: nd, cause: i, root: i });
  }
  if (P.closesBreath(t)) {   // the Measure
    for (const [, at] of openDebts) if (t - at >= HALF) tally.lateDebts++;
    const b = Math.floor(t / P.BREATH);
    for (let cell = 0; cell < FIB[4]; cell++) {   // five cells' claims this breath
      const claims = EIGHT.filter((q) => P.drawOf(b * P.BREATH + q.slot, DRAW.claim + cell) < 1 / PHI ** 2).map((q) => ({ slot: q.slot }));
      if (!claims.length) continue;
      const a = P.resolveClaims(claims, b), r = P.resolveClaims([...claims].reverse(), b);
      if (a.held !== r.held || a.winner?.slot !== r.winner?.slot) tally.claimOrderFails++;
      if (a.held) tally.claimsHeld++; else tally.claimsWon[P.GODS[a.winner.slot].key] = (tally.claimsWon[P.GODS[a.winner.slot].key] ?? 0) + 1;
    }
  }
}
const ms = performance.now() - t0;

// the end: one god a tick; the stocks rebuilt from the wake alone; then the whole run undone
const rebuilt = EIGHT.map(() => INIT), led = PAIRS.map(() => 0);
for (let i = 0; i < n; i++) { const e = P.decodeEntry(view, i); if (e.slot !== P.slotAt(e.t)) tally.wrongTick++; if (e.key < P.BREATH) rebuilt[e.key] += e.d; else led[e.key - P.BREATH] += e.d; }
const rebuiltOk = rebuilt.every((v, k) => v === stock[k]);
const undone = [...stock]; for (let i = n - 1; i >= 0; i--) { const e = P.decodeEntry(view, i); if (e.key < P.BREATH) undone[e.key] -= e.d; }
const undoneOk = undone.every((v) => v === INIT);
const hops = [...chains.values()].map((c) => c.hops), at8 = [...chains.values()].filter((c) => c.at8 != null).map((c) => c.at8);
const hist = {}; for (const h of hops) hist[h] = (hist[h] ?? 0) + 1;
// one chain to show: the first that started at 610
let showRoot = null; for (const [i, c] of chains) if (c.d0 === FIBS[14] && c.hops >= P.BREATH) { showRoot = i; break; }
const chain = []; if (showRoot != null) { const kids = new Map(); for (let i = 0; i < n; i++) { const e = P.decodeEntry(view, i); if (e.cause >= 0 && P.decodeEntry(view, e.cause).key === e.key || e.cause >= 0) (kids.get(e.cause) ?? kids.set(e.cause, []).get(e.cause)).push(i); }
  for (let i = showRoot; i != null;) { const e = P.decodeEntry(view, i); chain.push(`${P.GODS[e.slot].title} ${e.d > 0 ? "+" : ""}${e.d} ${STOCK[P.GODS[e.key]?.key] ?? "ledger"}`); i = (kids.get(i) ?? []).find((j) => P.decodeEntry(view, j).key < P.BREATH) ?? null; } }

const R = {
  sample: { breaths: BREATHS, ticks: TICKS, entries: n, bytes: n * P.ENTRY_BYTES, ms: Math.round(ms), usPerTick: +(ms * 1000 / TICKS).toFixed(2) },
  acts: { first: tally.first, answers: tally.answers, passes: tally.passes, debts: tally.debts, settled: tally.settled, openAtEnd: openDebts.size, cutOffAtEnd: tally.cutOff },
  chains: { hops: hist, longest: Math.max(...hops), meanHops: +(hops.reduce((a, b) => a + b, 0) / hops.length).toFixed(2), worstLeftAfterABreath: at8.length ? +Math.max(...at8).toFixed(4) : null, bound: +P.SETTLE.toFixed(4), worstUnitsOverBoundPlusSlack: +tally.worstOverBound.toFixed(4), slack: +P.SLACK.toFixed(4) },
  claims: { held: tally.claimsHeld, won: tally.claimsWon, orderFails: tally.claimOrderFails },
  measure: { wrongTick: tally.wrongTick, lateDebts: tally.lateDebts, rebuiltFromWake: rebuiltOk, undoneToStart: undoneOk, ledgersOpen: led.reduce((a, v) => a + Math.abs(v), 0) },
  stocks: { room: ROOM, atEnd: Object.fromEntries(EIGHT.map((g) => [STOCK[g.key], stock[g.slot]])), outOfRoom: tally.outOfRoom },
  exampleChain: chain,
};
console.log(JSON.stringify(R, null, 1));
if (out) fs.writeFileSync(out, JSON.stringify(R, null, 1) + "\n");
