// The pack's self-checks: the math's own promises, checked by running the math.
//
// Every law and every plan in Shipwright makes promises that can be checked without the game: a heel
// never passes its limit and always settles; a boat left alone always slows to a stop; a tide comes
// back to itself twice a day; the chunk plans stack their layers in order inside the world's height;
// Strongyle's agents kept their people's rules; a newcomer arrives standing on something. These are
// those promises, as checks. The tests run them all (and the boot lab); in the game,
// /scriptevent shipwright:check runs them as a job and reports, with which systems started.
//
// Each check is { name, ok, detail }. A check that throws is a failed check, never a crash.
import { tell } from "./warn.js";
import { system, world } from "@minecraft/server";
import { PLANS } from "./config/plans.js";
import { newRecord } from "./ship.js";
import { computeHandling } from "./handling.js";
import { heelLaw, driveLaw } from "./laws.js";
import * as LIM from "./world/limits.js";
import { waveHeight, washChance } from "./world/sealaws.js";
import { homeport, homeportIfReady, cityKind, PORT_PLAN } from "./world/homeport.js";
import { planSteps, CHUNK } from "./world/chunkgen.js";
import { FLOOR_MIN } from "./world/terrain.js";
import { raftSpot } from "./world/reach.js";
import { bootLine } from "./boot.js";
import { VERSION } from "./version.js";

const TOP = 319;                         // given: the highest block a dimension holds
export const CHECKS = Object.freeze({
  heelTicks: 900,                        // vision: how long a hull is rocked
  driveTicks: 1200,                      // vision: how long a boat is driven, then left alone
  samples: 9,                            // vision: chunks planned at random, beyond the arrival and the raft
  spread: 2000,                          // vision: how far out those lie
});

const check = (out, name, f) => {
  try {
    const r = f();
    out.push({ name, ok: r === true || r === undefined, detail: r === true || r === undefined ? "" : String(r) });
  } catch (err) {
    out.push({ name, ok: false, detail: `threw: ${err?.message ?? err}` });
  }
};
const finite = (...v) => v.every((x) => Number.isFinite(x));

/** Every plan's hull, at the middle of its lengths, rigged if it can be. */
function hulls() {
  const out = [];
  for (const plan of Object.values(PLANS)) {
    if (plan.id === "testship") continue;
    const L = Math.round((plan.lengthRange[0] + plan.lengthRange[1]) / 2);
    const r = newRecord(plan, "check", L);
    if (r.sections?.rig) r.sections.rig.sail = !!plan.rigFamily;
    out.push({ id: plan.id, h: computeHandling(r) });
  }
  return out;
}

/** The laws: stable, bounded, finite, for every hull. */
export function lawChecks() {
  const out = [];
  const hs = hulls();
  check(out, "handling: every hull's numbers are finite and positive", () => {
    const bad = hs.filter(({ h }) => !finite(h.max, h.accel, h.stability) || h.max <= 0 || h.accel <= 0 || h.stability <= 0).map((x) => x.id);
    return bad.length ? `bad: ${bad.join(", ")}` : true;
  });
  check(out, "heel: rocked hard for a while, never past its limit, never NaN, and it settles", () => {
    const bad = [];
    for (const { id, h } of hs) {
      const lim = { period: h.rollPeriod ?? 30, damping: h.rollDamping ?? 0.08, limit: h.heelLimit ?? 25, limitPos: h.floatHeel ?? h.heelLimit ?? 25 };   // vision: a hull's defaults
      let s = { heel: 0, rate: 0 };
      for (let t = 0; t < CHECKS.heelTicks; t++) {
        const target = (Math.floor(t / 40) % 2 ? 1 : -1) * 25;   // vision: the worst gusts, swapping sides
        s = heelLaw(s, t < CHECKS.heelTicks - 300 ? target : 5, lim);   // vision: then a steady breeze
        if (!finite(s.heel, s.rate) || s.heel > lim.limitPos + 1e-9 || s.heel < -lim.limit - 1e-9) { bad.push(`${id} at tick ${t}`); break; }   // vision: a check's tolerance or sample
      }
      const want = Math.max(-lim.limit, Math.min(lim.limitPos, 5));   // vision: a check's tolerance or sample
      if (Math.abs(s.heel - want) > 0.5 || Math.abs(s.rate) > 0.05) bad.push(`${id} doesn't settle (${s.heel.toFixed(2)} for ${want})`);   // vision: settled
    }
    return bad.length ? bad.slice(0, 6).join("; ") : true;   // vision: a check's tolerance or sample
  });
  check(out, "drive: oars and sail stay under the hull's ceiling, and a boat left alone always comes to rest", () => {
    const bad = [];
    for (const { id, h } of hs) {
      let v = 0, top = 0;
      const third = CHECKS.driveTicks / 3;   // vision: a check's tolerance or sample
      for (let t = 0; t < CHECKS.driveTicks; t++) {
        const phase = t < third ? "row" : t < 2 * third ? "astern" : "alone";
        const o = { wet: true, throttle: phase === "row" ? 1 : phase === "astern" ? -1 : 0, want: h.max, sailTarget: phase === "row" ? h.max * 1.5 : 0, sailing: phase === "row", pull: 1, aground: false, groundMax: 0.05, beachedDrag: 0.5 };   // vision: hard at it both ways, then nothing
        v = driveLaw(h, v, o).speed;
        top = Math.max(top, Math.abs(v));
        if (!finite(v)) { bad.push(`${id} NaN at ${t}`); break; }
      }
      if (top > h.max * 1.8 + 1e-9) bad.push(`${id} reached ${top.toFixed(3)} (ceiling ${(h.max * 1.8).toFixed(3)})`);   // given: driveLaw's ceiling
      if (Math.abs(v) > 0.01) bad.push(`${id} still moving at ${v.toFixed(3)} with nothing driving her`);   // vision: at rest
    }
    return bad.length ? bad.slice(0, 6).join("; ") : true;   // vision: a check's tolerance or sample
  });
  check(out, "limits: the frontier law and its solution agree; the tide comes back twice a day; drag and waves stay sane", () => {
    const m = { ...LIM.DEFAULT_MEASURED };
    for (const land of [0, 0.2, 0.5, 0.8]) for (const cLand of [8, 27]) {   // vision: sample worlds
      const v = LIM.frontierSpeed({ land, cLand, cSea: 3 }, m);   // vision: a sea chunk's cost
      if (!finite(v) || v <= 0) return `frontier speed ${v} at land ${land}`;
      if (Math.abs(LIM.frontierLaw({ v, land, cLand, cSea: 3 }, m) - LIM.BUDGET.frontier) > 1e-6) return `frontier law disagrees at land ${land}`;   // vision: a sea chunk's cost; precision
    }
    for (const t of [0, 1234, 9999]) {   // vision: sample times
      const a = LIM.tideLaw(1, 0.3, t), b = LIM.tideLaw(1, 0.3, t + LIM.GIVEN.DAY / 2);   // vision: a sample phase
      if (Math.abs(a - b) > 1e-9 || Math.abs(a) > 1) return `tide at ${t}: ${a} vs ${b}`;   // vision: precision
    }
    for (let fd = 0; fd <= 2; fd += 0.25) { const d = LIM.shallowDrag(fd); if (!finite(d) || d < 1) return `shallow drag ${d} at ${fd}`; }   // vision: sample depth numbers
    let last = 0;
    for (let U = 0; U <= 30; U += 3) { const H = waveHeight(U, 400); if (!finite(H) || H < last - 1e-9) return `waves fall as the wind rises at ${U}`; last = H; }   // vision: sample winds and fetch
    for (const H of [0, 0.5, 2]) for (const f of [0, 1, 3]) { const c = washChance(H, f); if (!(c >= 0 && c <= 1)) return `wash chance ${c}`; }   // vision: sample seas and freeboards
    return true;
  });
  return out;
}

/** Strongyle: its agents kept their rules, and a newcomer stands on something. */
export function portChecks(hp) {
  const out = [];
  check(out, "Strongyle: one quarter for every tradition, each with its dock, workshop and a home", () => {
    const short = hp.quarters.filter((q) => !q.dock || !q.pieces.some((p) => p.which === "main") || !q.pieces.some((p) => p.which === "home")).map((q) => q.key);
    return hp.quarters.length < 10 ? `only ${hp.quarters.length} quarters` : short.length ? `short: ${short.join(", ")}` : true;   // given: ten traditions
  });
  check(out, "Strongyle: no people built on another's ground, and every must-gate held (unless the log says it bent)", () => {
    const rects = hp.quarters.flatMap((q) => [q.apron, ...q.pieces.map((p) => p.rect)].map((r) => ({ q: q.i, r })));
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      if (rects[i].q === rects[j].q) continue;
      const a = rects[i].r, b = rects[j].r;
      if (!(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3])) return `quarters ${rects[i].q} and ${rects[j].q} overlap`;   // vision: a check's tolerance or sample
    }
    for (const q of hp.quarters) for (const l of q.log) if (l.ok && !l.relaxed && l.gates?.some((g) => g.startsWith("✗ must"))) return `${q.key} ${l.move} broke a must-gate`;
    return true;
  });
  check(out, "Strongyle: every dock's mouth opens on open water", () => {
    for (const q of hp.quarters) {
      const m = { x: q.dock.o.x + q.dock.d.x * (PORT_PLAN.dock.length + 4), z: q.dock.o.z + q.dock.d.z * (PORT_PLAN.dock.length + 4) };   // vision: just past the mouth
      const k = cityKind(hp, m.x, m.z)?.kind;
      if (k !== "lagoon" && k !== "canal") return `${q.key}'s mouth opens on ${k}`;
    }
    return true;
  });
  check(out, "Strongyle: newcomers arrive standing on a deck; the bell is on the quay; the raft floats", () => {
    const s = cityKind(hp, Math.floor(hp.spawn.x), Math.floor(hp.spawn.z));
    if (!s || !("deckTop" in s)) return `the arrival place is ${s?.kind ?? "outside the port"}`;
    if (s.deckTop !== Math.floor(hp.spawn.y) - 1) return `arrival at y ${hp.spawn.y} over a deck at ${s.deckTop}`;
    if (cityKind(hp, hp.bell.x, hp.bell.z)?.kind !== "jetty") return `the bell stands on ${cityKind(hp, hp.bell.x, hp.bell.z)?.kind}`;
    const r = cityKind(hp, hp.raft.x, hp.raft.z)?.kind;
    if (r !== "lagoon") return `the raft lies on ${r}`;
    return true;
  });
  return out;
}

/** A chunk's plan holds together: layers in order inside the world's height, water over the bed, blocks in the chunk. */
export function planCheck(p) {
  const x0 = p.cx * CHUNK, z0 = p.cz * CHUNK;
  for (const c of p.columns) {
    let last = FLOOR_MIN - 1;
    for (const [a, b, id] of c.layers) {
      if (!(a <= b) || a <= last || a < FLOOR_MIN || b > TOP) return `column ${c.x},${c.z}: layer ${a}..${b} out of order (after ${last})`;
      if (typeof id !== "string" || !/^(minecraft|shipwright):[a-z0-9_]+$/.test(id)) return `column ${c.x},${c.z}: bad block id ${id}`;
      last = b;
    }
    if (c.water) {
      const [w0, w1] = c.water;
      if (w0 > w1 + 1 || w1 > TOP) return `column ${c.x},${c.z}: water ${w0}..${w1}`;
      const hit = c.layers.find(([a, b]) => a <= w1 && b >= w0);
      if (hit) return `column ${c.x},${c.z}: ${hit[2]} at ${hit[0]}..${hit[1]} inside its water ${w0}..${w1}`;
    }
  }
  for (const b of p.blocks) {
    if (b.x < x0 || b.x >= x0 + CHUNK || b.z < z0 || b.z >= z0 + CHUNK || b.y < FLOOR_MIN || b.y > TOP) return `block ${b.id} at ${b.x},${b.y},${b.z} outside the chunk`;
    if (!/^(minecraft|shipwright):[a-z0-9_]+$/.test(b.id)) return `bad block id ${b.id}`;
  }
  return true;
}

/** Which chunks to plan: where newcomers arrive and round it, the castaways' raft, and a few at random. */
export function sampleChunks(seed, hp) {
  const out = [];
  const at = (x, z) => out.push([Math.floor(x / CHUNK), Math.floor(z / CHUNK)]);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) at(hp.spawn.x + i * CHUNK, hp.spawn.z + j * CHUNK);
  const r = raftSpot(seed);
  at(r.x, r.z);
  at(hp.light.x, hp.light.z);
  at(hp.x, hp.z);
  for (let k = 0; k < CHECKS.samples; k++) {
    const a = ((seed % 997) + k * 2.399) % (Math.PI * 2), d = (CHECKS.spread * (k + 1)) / CHECKS.samples;   // given: the golden angle (radians), to spread them
    at(hp.x + Math.cos(a) * d, hp.z + Math.sin(a) * d);
  }
  return out;
}

/** Every check, as steps (the chunk plans are a game job's work). */
export function* selfChecks(seed) {
  const out = [...lawChecks()];
  yield;
  const hp = homeportIfReady(seed) ?? homeport(seed);
  out.push(...portChecks(hp));
  yield;
  const bad = [];
  for (const [cx, cz] of sampleChunks(seed, hp)) {
    let p = null;
    try { p = yield* planSteps(seed, cx, cz); } catch (err) { bad.push(`${cx},${cz} threw: ${err?.message ?? err}`); continue; }
    const r = planCheck(p);
    if (r !== true) bad.push(`${cx},${cz}: ${r}`);
  }
  out.push({ name: "chunk plans hold together (the arrival, the raft, the light, the citadel, and samples out to 2,000 blocks)", ok: !bad.length, detail: bad.slice(0, 4).join("; ") });   // vision: a check's tolerance or sample
  return out;
}

export function startChecks() {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "shipwright:check") return;
    const say = (m) => { console.warn(m); tell(ev.sourceEntity, m); };
    say(bootLine(VERSION));
    say("[Shipwright] Running the self-checks...");
    system.runJob((function* () {
      let seed;
      try { seed = Number(world.getDynamicProperty("shipwright:seed")) || 0; } catch { seed = 0; }
      const res = yield* selfChecks(seed);
      const failed = res.filter((r) => !r.ok);
      say(`[Shipwright] Self-checks: ${res.length - failed.length} of ${res.length} passed.`);
      for (const f of failed) say(`§c[Shipwright] FAILED: ${f.name}: ${f.detail}`);
    })());
  });
}
