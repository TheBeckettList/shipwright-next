// The lab: every lens on the core and the world, no game needed.
//
//   node tools/lab.mjs [lens ...]       lenses: golden reverse purity globe sea boat analogues tempo lod
//                                       world peoples inherency vanilla pantheon   (none: all)
//   node tools/lab.mjs render out.png   the world map: depth, biomes, peoples by temper
//
// Each lens returns { ok, lines }; tests/lab.test.mjs runs them all and fails on any not ok.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { VISION, GIVEN, D } from "../core/given.js";
import { F, kron, order, breath, pisano, lineStep, lineUnstep, point } from "../core/field.js";
import { FIB as FIB_, FIBS as FIBS_ } from "../core/golden.js";
import { stones as stonesList } from "../world/stones.js";
import { step, unstep, purity, bits } from "../core/reversible.js";
import { boatAt, OPS, KEYS, project } from "../core/boat.js";
import { fold, overPole, greatCircle, zOfLat, xOfLon, latOf, lonOf, W, H } from "../core/globe.js";
import { windAt, belt } from "../core/wind.js";
import { tideAt, seaState, wavesAt, currentEast } from "../core/sea.js";
import { groupLaws } from "../core/frames.js";
import { profile, stats, phasePlan, goldenBeats, BAR } from "../core/tempo.js";
import { census, load, LEVELS } from "../core/lod.js";
import { loadMap } from "../world/load.js";
import { chunkHeight, blockHeight, map, heightOf as mapHeightOf } from "../world/map.js";
import { islands, smallestRound } from "../world/islands.js";
import { climateAt } from "../world/climate.js";
import { peoples, dayOf } from "../world/peoples.js";
import { LAND_BIOMES, SEA_BIOMES, BEACH, ORES } from "../world/biomes.js";
import { TRADITIONS } from "../world/traditions.js";
import { worldOf, tick, untick, era as runEra, atPoint, grow, balance as recBalance } from "../core/cycles.js";
import { loop, firstWorld, bake, yearOf, HISTORY, REALMS } from "../world/history.js";
import { societyOf, ranks, PROFESSIONS } from "../world/society.js";
import { when, RUNGS, YEAR_TICKS, YEAR_DAYS } from "../core/clock.js";
import { wealthWalk, buildingsAt, monthRecords, continuanceLogs, planOf } from "../world/buildings.js";
import { whereAt, rosterAt, theraCrowd } from "../world/folk.js";
import { bandsIn, bandAt, TIERS } from "../world/pirates.js";
import { SHIP_STORES as SHIP_STORES_ALL } from "../world/ships.js";
import { continuance, undo, BOUNDS } from "../world/continuance.js";
import { styleOf, newPort, deliver, day as portDay, STAGES } from "../world/homeport.js";
import { economy, ledger } from "../world/economy.js";
import { layout, wallKeys, plotsAt } from "../world/settlement.js";
import { columnRock, PROVINCES } from "../game/strata.js";
import { theranPeople } from "../world/therans.js";
import { pinnacle, floorsOf, PINNACLE, CLIFF } from "../world/pinnacle.js";
import { skinOf, DRESS, CULTURES, RANKS, SKINS } from "../world/dress.js";
import { NAMES } from "../world/names.js";
import { LADDERS, CALIBRATION, HISTORY as CAL_HISTORY } from "../game/calibration.js";
import { TABLE as PTABLE, formulaOf, assemble, joinOf, fitStack, STOREYS } from "../world/periodic.js";
import { theraPlan, useSectors } from "../world/theracity.js";
import { roomVox, MATS } from "../world/roomvox.js";
import { observePeople, observeVillager, observePlace } from "../world/observer.js";
import { lifeAt, AMBIENT } from "../world/ambient.js";
import { fillGaps } from "../core/tempo.js";
import { budget } from "../world/budget.js";
import * as PAN from "../core/pantheon.js";
import { league, presiding, PIECES } from "../world/league.js";
import { MINT } from "../world/trade.js";
import { houseOf, FORM as HOUSE_FORM, ROUNDNESS } from "../world/dwelling.js";
import { compound, reaction } from "../world/chem.js";
import { populations, townOf, theraBoxes } from "../world/boxes.js";
import { seaSummary, regions as seaRegions, clericsOf, coralBook } from "../world/sealife.js";
import { riteStrength, rite } from "../world/solar.js";
import { explorers, explorerAt, meet, chartOf, EXPLORE } from "../world/explorers.js";
import { sails as sailTex, simBlocks } from "./maketextures.mjs";
import { TEXTURE, VARIANTS, STRING_FRAMES, waterAt, tileOf, texel, lookOf, variantsOf, facesOf } from "../world/textures.js";
import { stringFrames } from "../core/patterns.js";
import { rings as sightRings, detailBudget, fadesAt, SIGHT } from "../core/sight.js";
import { waveDamage, waveMax, seaState as seaStateOf } from "../core/sea.js";
import { seaOnHull } from "../core/boat.js";
import { JOBS, FOOD } from "../world/jobs.js";
import { exists, mobExists } from "../lab/vanilla.js";
import { encode } from "./png.js";
import { THERA, theraHeight } from "../world/thera.js";
import { cityAt, quarterSeeds, geometry } from "../world/city.js";
import { towns } from "../world/towns.js";
import { THERANS, TOWN_KINDS } from "../world/therans.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let mapped = false;
const world = () => { if (!mapped) { loadMap(); mapped = true; } };

export const LENSES = {
  golden() {
    const b = [2, 4, 8, 16, 32].map((L) => [L, breath(L), breath(L, false)]);
    let x = point(16), y; for (let t = 0; t < 50; t++) x = lineStep(x, t); y = x; for (let t = 49; t >= 0; t--) y = lineUnstep(y, t);
    const ok = b.every(([L, m, r]) => m === 2 * L && r === 3 * L) && order(F, 3) === 8 && order(kron(F, F, 3), 3) === 4 && y.every((v, i) => v === +(i === 0)) && groupLaws().closed;
    return { ok, lines: [`breaths (Mobius/ring): ${b.map(([L, m, r]) => `L${L} ${m}/${r}`).join(" ")}; F mod 3 order ${order(F, 3)}, F(x)F ${order(kron(F, F, 3), 3)}; line runs back to the point: ${y.every((v, i) => v === +(i === 0))}; frames' group closed: ${groupLaws().closed}`] };
  },
  reverse() {
    const s = boatAt({ x: xOfLon(-40), z: zOfLat(20), heading: 300, L: 8, keep: 4000 });
    const ctx = (t) => ({ t, helm: Math.sin(t / 40), sail: t % 500 < 400, h: s.h });
    const b0 = bits(s, KEYS), n = 3000;
    for (let t = 0; t < n; t++) step(s, OPS, ctx(t));
    const far = project(s);
    for (let t = n - 1; t >= 0; t--) unstep(s, OPS, ctx(t));
    const ok = bits(s, KEYS) === b0;
    return { ok, lines: [`a boat sailed ${n} ticks (${(n / 20 / 60).toFixed(1)} min, helm and sail working, gusts, current) to ${far.x.toFixed(0)},${far.z.toFixed(0)}, then run back: ${ok ? "identical bits" : "DIFFERENT"}`] };
  },
  purity() {
    const s = boatAt({ x: 1000, z: zOfLat(30), heading: 45 });
    const bad = purity(s, OPS, { t: 7, helm: 0.6, sail: true, h: s.h });
    return { ok: !bad.length, lines: [bad.length ? `shears that read their own key: ${bad.join(", ")}` : `every shear is pure (${OPS.filter((o) => o.shear).length} shears, ${OPS.filter((o) => o.record).length} records)`] };
  },
  globe() {
    const p = { x: 1234.5, z: 300.25, heading: 19661 };   // vision: any point, any whole heading
    const twice = overPole(overPole(p));
    const inv = twice.x === p.x && twice.z === p.z && twice.heading === p.heading;
    const f = fold(1000, -10), g = fold(1000, W + 10);
    const meridian = fold(500, 200 + W);
    const gc = greatCircle({ x: 0, z: H / 2 }, { x: W / 2, z: H / 2 });
    const ok = inv && f.sheet && Math.abs(f.x - (1000 + H)) < 1e-9 && Math.abs(f.z - 10) < 1e-9 && !g.sheet && Math.abs(meridian.z - 200) < 1e-9 && Math.abs(gc - W / 2) < 1e-6;
    return { ok, lines: [`over the pole twice is nothing: ${inv}; 10 blocks past the north pole is ${f.z.toFixed(0)} blocks down the far meridian (x + ${H}); a full meridian (W) comes home; half the equator is ${gc.toFixed(0)} = W/2`] };
  },
  sea() {
    const z = zOfLat(40), x = 5000;
    const st = seaState(10), t0 = tideAt(x, z, 0), t1 = tideAt(x, z, GIVEN.DAY / 2);
    const ok = Math.abs(t0 - t1) < 1e-9 && st.Hs > 1 && st.Hs < 3 && Math.abs(currentEast(zOfLat(10)) + 0.5 * D.MPS) < 1e-12;
    return { ok, lines: [`tide comes round twice a day (${t0.toFixed(2)} = ${t1.toFixed(2)}); a 10 m/s sea: Hs ${st.Hs.toFixed(2)} blocks, wavelength ${st.lambda.toFixed(0)}, period ${st.period.toFixed(0)} ticks under Minecraft's gravity; waves at 40N now: ${wavesAt(x, z, 0).eta.toFixed(2)}`] };
  },
  boat() {
    const out = [];
    for (const [lat, lon] of [[15, -40], [45, 0]]) {
      const x = xOfLon(lon), z = zOfLat(lat), w = windAt(x, z, 0), row = [];
      for (let hd = 0; hd < 360; hd += 45) {
        const s = boatAt({ x, z, heading: hd, L: 8, keep: 10 });
        for (let t = 0; t < 1200; t++) step(s, OPS, { t, helm: 0, sail: true, h: s.h });
        row.push(`${hd}:${project(s).speed.toFixed(1)}`);
      }
      out.push(`${lat}N ${w.belt} from ${w.from.toFixed(0)} at ${w.speed.toFixed(1)} m/s; an 8-block square-rigger after a minute, m/s by heading: ${row.join(" ")}`);
    }
    return { ok: true, lines: out };
  },
  async hulls() {
    // the boats in stages, the sim: every people's hull at its typical length through core/boat.js's trials (tools/boatsim.mjs)
    const { boatTrials } = await import("./boatsim.mjs"), rows = boatTrials(), bad = [];
    for (const r of rows) {
      if (Math.max(r.mean, r.pull) <= 0) bad.push(`${r.boat} cannot move`);
      if (r.pull > r.hullSpeed) bad.push(`${r.boat} pulled past her hull speed`);
      if (r.rig && r.winds.some((w) => w.polar.some(([, v]) => v > 2 * r.hullSpeed))) bad.push(`${r.boat} sails past twice her hull speed`);
      if (r.rig && !r.stands) bad.push(`${r.boat} lays over in the working wind`);
      if (r.rig && r.reef < r.winds[1].W) bad.push(`${r.boat} must reef in the working wind`);
    }
    const fa = rows.filter((r) => r.rig === "fore_and_aft"), sq = rows.filter((r) => r.rig === "square"), up = (a) => a.reduce((s, r) => s + r.upwind, 0) / a.length;
    if (!(up(fa) > up(sq))) bad.push("the lateen, lug and crab claw don't point higher than the square sail");
    const fast = [...rows].sort((a, b) => Math.max(b.mean, b.pull) - Math.max(a.mean, a.pull))[0], slow = [...rows].sort((a, b) => Math.max(a.mean, a.pull) - Math.max(b.mean, b.pull))[0];
    return { ok: !bad.length, lines: [`${rows.length} hulls tried: fastest over every course ${fast.boat} (${Math.max(fast.mean, fast.pull).toFixed(1)} m/s), slowest ${slow.boat} (${Math.max(slow.mean, slow.pull).toFixed(1)}); to windward the fore-and-aft rigs make ${up(fa).toFixed(1)} m/s good, the square ${up(sq).toFixed(1)}`, ...bad] };
  },
  analogues() {
    world();
    // block <-> chunk: Froude similarity (lengths x16, times x4 keep the dimensionless numbers)
    const a = seaState(8), k16 = a.k / 16, w16 = Math.sqrt(GIVEN.G * k16);
    const froude = Math.abs(a.omega / w16 - 4) < 1e-9;
    // chunk <-> world: the land share by blocks (sampled), by chunks, and by 16 x 16-chunk regions agree
    const m = map(); let landC = 0; for (let k = 0; k < m.data.length; k++) if (chunkHeight(k % m.w, (k / m.w) | 0) > 0) landC++;
    let landB = 0, nB = 0; for (let i = 0; i < 40000; i++) { const x = ((i * 7919) % W) + 0.5, z = ((i * 104729) % H) + 0.5; nB++; if (blockHeight(x, z) > 0) landB++; }   // vision: a fixed sampling of block points
    let landR = 0, nR = 0; for (let j = 0; j < m.h; j += 16) for (let i = 0; i < m.w; i += 16) { let s = 0; for (let b = 0; b < 16; b++) for (let a2 = 0; a2 < 16; a2++) s += chunkHeight(i + a2, j + b) > 0 ? 1 : 0; landR += s / 256; nR++; }   // given: 16 x 16 chunks a region
    const sc = landC / m.data.length, sb = landB / nB, sr = landR / nR;
    const ok = froude && Math.abs(sb - sc) < 0.02 && Math.abs(sr - sc) < 1e-9;
    return { ok, lines: [`block -> chunk: a wave 16 times longer runs exactly 4 times slower (Froude): ${froude}`, `land share by block ${sb.toFixed(3)}, by chunk ${sc.toFixed(3)}, by region ${sr.toFixed(3)}`] };
  },
  tempo() {
    const c = JSON.parse(fs.readFileSync(path.join(root, "lab/legacy_census.json"), "utf8")).filter((t) => !t.transient);
    const a = stats(profile(c)), b = stats(profile(c, phasePlan(c)));
    return { ok: b.peak < a.peak, lines: [`golden beats in a ${200}-tick bar: ${goldenBeats().map((x) => x.period).join(", ")}; the old mod's timers: peak ${a.peak} -> ${b.peak} by phase alone`] };
  },
  lod() {
    const c = census(), l = load();
    return { ok: l.total < 4 * c.rendered, lines: [`round a player: ${c.rendered} chunks rendered (every tick), ${c.edge} on the edge (every ${LEVELS[1].beat}), ${c.chunk} as chunk math (every ${LEVELS[2].beat}), the rest closed form; work ${l.total.toFixed(0)} chunk-steps a tick, ${(l.total / c.rendered).toFixed(2)} x the rendered ring`] };
  },
  world() {
    world();
    const I = islands(), big = [...I.info].sort((a, b) => b.area - a.area), land = I.info.reduce((a, i) => a + i.area, 0) / (I.W * I.H);
    const FIBS = FIBS_, FIB = FIB_, hop = smallestRound(FIBS[13]);   // the map's own least hop round (the square cays retired: the stones bridge the rest)
    const ST = stonesList().filter((s) => s.route), X = VISION.CROSSING;
    const wdx = (a, b) => { const d = Math.abs(a - b) % D.W; return Math.min(d, D.W - d); }, near = (s) => ST.some((o) => o !== s && Math.hypot(wdx(o.x, s.x), o.z - s.z) <= X) || Array.from({ length: FIB[6] }, (_, q) => q).some((q) => { for (let r = FIB[7]; r <= X; r += FIB[7]) if (chunkHeight(Math.floor((s.x + Math.cos(2 * Math.PI * q / FIB[6]) * r) / D.PX), Math.floor((s.z + Math.sin(2 * Math.PI * q / FIB[6]) * r) / D.PX)) > 0) return true; return false; });
    const loose = ST.filter((s) => !near(s)).length;
    const ok = land >= VISION.LAND[0] && land <= VISION.LAND[1] && hop !== null && ST.length > 0 && loose === 0;
    return { ok, lines: [`${D.W} x ${D.H} blocks (${I.W} x ${I.H} chunks), land ${(land * 100).toFixed(1)}%, ${I.info.length} islands; largest ${big.slice(0, 4).map((i) => i.area).join(", ")} chunks`, `round the world: the map's least hop is ${hop} chunks; ${ST.length} route stones bridge it for a small boat (${loose} without a stone or a coast within ${X} blocks)`] };
  },
  peoples() {
    world();
    const P = peoples().list, n = (f) => { const m = {}; for (const p of P) m[f(p)] = (m[f(p)] ?? 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "); };
    return { ok: P.length > 0, lines: [`${P.length} peoples`, `living: ${n((p) => p.living)}`, `temper: ${n((p) => p.temper)}`, `tradition: ${n((p) => p.tradition)}`, `frames: ${n((p) => p.build.frame.kind)}; roofs: ${n((p) => p.build.roof.pitch)}`, `at noon: ${n((p) => dayOf(p, 6000).doing)}`, `at midnight: ${n((p) => dayOf(p, 18000).doing)}`] };
  },
  thera() {
    // the research's shape: a bay that reaches the sea only through the north-west, an island in it, Profitis Ilias the highest
    const S = 8, Rb = THERA.REACH * 16, n = (2 * Rb) / S, wet = new Uint8Array(n * n);   // vision: the lens's grid (blocks a cell, reach)
    let top = { h: -1e9 };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const u = -Rb + i * S, v = -Rb + j * S, t = theraHeight(u, v); wet[j * n + i] = t.h <= 0 ? 1 : 0; if (t.h > top.h) top = { ...t, u, v }; }
    const B = THERA.bay, D0 = THERA.dome;
    const start = [Math.round(((D0.x) * THERA.KM + Rb) / S), Math.round((-(D0.y + D0.r * 1.3) * THERA.KM + Rb) / S)];   // vision: the bay's water just north of Pre-Kameni
    const reachesSea = (mask) => {
      const seen = new Uint8Array(n * n), q = [start[1] * n + start[0]]; seen[q[0]] = 1;
      while (q.length) { const c = q.pop(), i = c % n, j = (c / n) | 0;
        if (Math.hypot(i - n / 2, j - n / 2) > (n / 2) * 0.96) return true;   // vision: the lens's edge is the open sea
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b, k = jj * n + ii; if (ii < 0 || jj < 0 || ii >= n || jj >= n || seen[k] || !wet[k] || mask(ii, jj)) continue; seen[k] = 1; q.push(k); } }
      return false;
    };
    const bearing = (i, j) => (Math.atan2(i - start[0], -(j - start[1])) * 180 / Math.PI + 360) % 360;
    const open = reachesSea(() => false), onlyNW = !reachesSea((i, j) => { const b = bearing(i, j); return b > 280 && b < 350 && Math.hypot(i - start[0], j - start[1]) > (B.a * THERA.KM / S) * 0.8; });   // vision: the north-west sector
    const DM = THERA.dome, isle = theraHeight(DM.x * THERA.KM, -DM.y * THERA.KM).h > 0;
    const moat = [0, 1, 2, 3].every((k) => theraHeight((DM.x + Math.cos(k * Math.PI / 2) * DM.r * 1.45) * THERA.KM, -(DM.y + Math.sin(k * Math.PI / 2) * DM.r * 1.45) * THERA.KM).h <= 0);   // vision: water a little beyond the dome on every side
    world();
    // seated in the map's own sea: under the island and its shelf the map has no land of its own (Thera is laid into the sea, not cut out of it)
    const foot = -THERA.shelf / THERA.M, R = THERA.REACH, M0 = map(); let clash = 0, edgeStep = 0;
    for (let b = -R; b <= R; b += 2) for (let a = -R; a <= R; a += 2) { const h = theraHeight((a + 0.5) * 16, (b + 0.5) * 16).h; const ca = Math.floor(((a + 0.5) * 16) / D.PX), cb = Math.floor(((b + 0.5) * 16) / D.PX), k = (THERA.seat.cz + cb) * M0.w + (((THERA.seat.cx + ca) % M0.w) + M0.w) % M0.w, base = mapHeightOf(M0.data[k]); if (h > foot + 1 && base > 0) clash++; }   // vision: every second chunk
    const seated = clash === 0;
    const ok = open && onlyNW && isle && moat && top.what === "Profitis Ilias" && seated;
    return { ok, lines: [`the bay reaches the sea: ${open}, only by the north-west strait: ${onlyNW}; Pre-Kameni stands in it: ${isle && moat}; the highest point is ${top.what} at ${top.h.toFixed(0)} blocks (${(top.h * THERA.M).toFixed(0)} m)`, `seated at chunk ${THERA.seat.cx}, ${THERA.seat.cz} (${latOf(THERA.seat.cz * 16).toFixed(1)}N, ${lonOf(THERA.seat.cx * 16).toFixed(1)}), the island and its shelf laid into the map's own sea, no square of its own (map land under it: ${clash} chunks, every second one): ${seated}`] };
  },
  city() {
    world();
    const g = geometry(), S = quarterSeeds(), T = towns();
    const lightOnStack = g.lightAt && theraHeight(g.lightAt.x * THERA.KM, -g.lightAt.y * THERA.KM).what === "the strait stack";
    // every kind the plan promises appears on a sweep of the bay
    const seen = new Map();
    for (let x = -4.6; x <= 3; x += 0.025) for (let y = -0.6; y <= 7.4; y += 0.025) { const c = cityAt(x, y); seen.set(c.kind, (seen.get(c.kind) ?? 0) + 1); if (c.culture) seen.set(c.culture, (seen.get(c.culture) ?? 0) + 1); }   // vision: the sweep (km)
    // the redesign (claude/thera-redesign.md): the cothon, the Therans' waterways round the cone and the cone's own city; no quarters or canals in the lagoon
    const kinds = ["round harbour", "harbour master's island", "shipsheds", "fairway", "inner city", "street", "stairs", "acropolis", "ring canal", "bay"], gone = ["merchant harbour", "the Exchange", "wall canal", "canal", "quarter", "stilt quarter"];
    const missing = kinds.filter((k) => !seen.has(k)), left = gone.filter((k) => seen.has(k));
    const wantTowns = TOWN_KINDS.reduce((a, k) => a + k.count, 0);
    const ok = lightOnStack && !missing.length && !left.length && T.length === wantTowns;
    return { ok, lines: [`the Light on the strait stack: ${!!lightOnStack}; every part of the plan drawn: ${!missing.length}${missing.length ? ` (missing ${missing.join(", ")})` : ""}; the old maze gone: ${!left.length}${left.length ? ` (still: ${left.join(", ")})` : ""}`,
      `Theran towns ${T.length} of ${wantTowns}: ${T.map((t) => `${t.name} (${t.kind}, ${Math.round(t.blend.cave * 100)}/${Math.round(t.blend.akrotiri * 100)}/${Math.round(t.blend.whitewash * 100)} cave/Akrotiri/whitewash)`).join(", ")}`] };
  },
  cycles() {
    // the engine alone: exact reversal (a coarse pulse driving a finer record too), the breath, the whole world's return in whole breaths, balance as it grows
    const ctrl = Array.from({ length: 14 }, (_, i) => Math.floor((i * 6) / 14));   // vision: six realms over fourteen peoples
    const w = worldOf(6, Array.from({ length: 14 }, (_, i) => [1, -1, 0][i % 3]), ctrl);   // vision: any record
    const s0 = JSON.stringify([w.pulse, w.record]);
    for (let k = 0; k < 700; k++) tick(w); for (let k = 0; k < 700; k++) untick(w);   // vision: a long run
    const back = JSON.stringify([w.pulse, w.record]) === s0;
    const small = worldOf(8), start = JSON.stringify(small.record); let br = 0;
    do { runEra(small); small.t = 0; br++; } while (atPoint(small) && JSON.stringify(small.record) !== start && br < 100);   // vision: a search cap
    const breathes = atPoint(small);
    const g = worldOf(4); for (let e = 0; e < 60; e++) { runEra(g); grow(g); }   // vision: sixty eras of growth
    const b = recBalance(g.record), even = Math.max(b.up, b.still, b.down) < 0.45;   // vision: no third over 45%
    return { ok: back && breathes && even, lines: [`runs back exactly (a 6-cell pulse driving 14 record cells): ${back}; the pulse breathes in 2P: ${breathes}; a loop of 8 comes home after ${br} breaths; grown to ${g.record.length} cells: up ${(b.up * 100).toFixed(0)}% still ${(b.still * 100).toFixed(0)}% down ${(b.down * 100).toFixed(0)}%`] };
  },
  history() {
    world();
    const L = loop(), w = firstWorld(), lines = [], Y = yearOf(0);
    let maxLean = 0, worst = 0;
    const byMonth = [];
    for (let m = 1; m <= 12; m++) {   // vision: a year, month by month
      runEra(w, null, RUNGS.month);
      const b = bake(w);
      maxLean = Math.max(maxLean, ...b.borders.map((x) => Math.abs(x.lean)));
      worst = Math.max(worst, b.balance.up, b.balance.still, b.balance.down);
      byMonth.push(`${(b.balance.up * 100).toFixed(0)}/${(b.balance.still * 100).toFixed(0)}/${(b.balance.down * 100).toFixed(0)} c${b.borders.filter((x) => x.state === "contested").length}`);
    }
    const yearEnd = atPoint(w);
    const r = firstWorld(); for (let k = 0; k < 200; k++) tick(r); const s = JSON.stringify(r.record); for (let k = 0; k < YEAR_DAYS; k++) tick(r); for (let k = 0; k < YEAR_DAYS; k++) untick(r);   // vision: from day 200, a year forward and back
    const back = JSON.stringify(r.record) === s;
    const ok = maxLean <= HISTORY.FLEX && worst < 0.5 && back && yearEnd;   // vision: no third holds half the world
    return { ok, lines: [`${L.length} peoples in ${REALMS} realms; a year is ${Y.length} days (${Y.minutes.toFixed(0)} minutes of play); the realms' pulse is home at the year's end: ${yearEnd}; a whole year runs back exactly: ${back}`,
      `month by month (rising/steady/waning %, contested borders): ${byMonth.join("  ")}`, `borders lean at most ${maxLean} chunks (bound ${HISTORY.FLEX})`] };
  },
  society() {
    world();
    const w = firstWorld(); runEra(w, null, RUNGS.month);
    const b = bake(w), fort = new Map(loop().map((p, i) => [p.key, w.record[i]])), R = ranks(fort);
    const S = peoples().list.map((p) => societyOf(p, b, w));
    const count = (f) => { const m = {}; for (const s of S) m[f(s)] = (m[f(s)] ?? 0) + 1; return m; };
    const acts = count((s) => s.action), seats = [...R.values()].filter((r) => r === "seat").length;
    const top = Math.max(...Object.values(acts)) / S.length;
    const badJobs = PROFESSIONS.filter((p) => !exists(p.block)).map((p) => p.block);
    const ok = seats === Object.keys(TRADITIONS).length && top < 1 / ((1 + Math.sqrt(5)) / 2) && (acts.raid ?? 0) > 0 && !badJobs.length;   // vision: no one action past the golden share of the world (the peoples round Thera, the trade centre, trade most), and raids happen
    const fmt = (m) => Object.entries(m).sort((a, b2) => b2[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ");
    return { ok, lines: [`actions: ${fmt(acts)}`, `goals: ${fmt(count((s) => s.goal))}`, `one seat a tradition: ${seats === Object.keys(TRADITIONS).length}; job blocks vanilla: ${!badJobs.length}; folk ${S.reduce((a, s) => a + s.folk, 0)}`] };
  },
  clock() {
    const golden = [RUNGS.breath, RUNGS.second, RUNGS.beat, RUNGS.month, RUNGS.season, RUNGS.year].every((x) => YEAR_DAYS * RUNGS.day % x === 0);
    const mid = when(0), win = when(YEAR_TICKS / 2), next = when(YEAR_TICKS), sun = YEAR_TICKS % RUNGS.sky === 0;
    const ok = mid.season === "summer" && mid.warmth === 1 && win.season === "winter" && Math.abs(win.warmth + 1) < 1e-9 && next.year === 1 && YEAR_TICKS / 20 / 60 >= 120 && sun && golden;   // given: two hours is 120 minutes
    return { ok, lines: [`a year is ${YEAR_DAYS} days of ${RUNGS.day} ticks: ${YEAR_TICKS} ticks, ${(YEAR_TICKS / 20 / 60).toFixed(0)} minutes, ${YEAR_TICKS / RUNGS.sky} Minecraft days (the sky keeps step: ${sun})`,
      `every rung a golden period: breath ${RUNGS.breath}, second ${RUNGS.second}, beat ${RUNGS.beat}, month ${RUNGS.month} days, season ${RUNGS.season}, year ${RUNGS.year} (pisano 135); midsummer opens it, midwinter is its half-breath: ${mid.season === "summer" && win.season === "winter"}`] };
  },
  buildings() {
    world();
    const n = 24, W = wealthWalk(n), L = loop(), recs = monthRecords(n);   // vision: two years, month by month
    const share = (y) => W.reduce((a, w) => a + w.walk[y], 0) / W.reduce((a, w) => a + w.size, 0);
    const shares = Array.from({ length: n + 1 }, (_, y) => share(y));
    const moved = W.filter((w) => new Set(w.walk).size > 1).length;
    const bounded = W.every((w) => w.walk.every((v) => v >= 2 && v <= w.size));   // vision: the core
    const i = W.findIndex((w) => w.walk[1] > w.walk[0]), p = L[i];
    const seen = new Set(); for (const u of [0.05, 0.2, 0.35, 0.45, 0.9]) for (const b of buildingsAt(p, W[i].walk, 0, u, recs[0][i])) if (b.state === "building") seen.add(b.stage);   // vision: through the year
    const j = W.findIndex((w) => w.walk[1] < w.walk[0]), fall = new Set(); if (j >= 0) for (const u of [0.1, 0.3, 0.7]) for (const b of buildingsAt(L[j], W[j].walk, 0, u, recs[0][j])) if (["abandoned", "ruin", "cleared"].includes(b.state)) fall.add(b.state);   // vision: through the year
    const ok = bounded && moved > L.length / 4 && Math.max(...shares) - Math.min(...shares) < 0.15 && seen.size === 4 && fall.size === 3;   // vision: a quarter of the peoples move; the world's share keeps within this
    return { ok, lines: [`plans standing month by month over two years: ${shares.filter((_, k) => k % 2 === 0).map((x) => `${(x * 100).toFixed(0)}%`).join(" ")}; ${moved} peoples built or lost something; all within their plans' bounds: ${bounded}`,
      `a rising year shows ${[...seen].join(" -> ")}; a falling one ${[...fall].join(" -> ")} (materials back to the people); a home costs ${Object.entries(planOf(p)[0].bill).map(([k, v]) => `${v} ${k.replace("minecraft:", "")}`).join(", ")}`] };
  },
  ships() {
    world();
    const S = peoples().list.map((p) => societyOf(p)), short = { hull: 0, fasten: 0, sail: 0 };
    for (const x of S) for (const k in short) if (x.fleet.short[k] > 0.5) short[k]++;   // vision: more than half short
    const boats = S.reduce((a, x) => a + x.fleet.boats, 0), wrights = S.reduce((a, x) => a + (x.professions.shipwright ?? 0), 0);
    const kinds = {}; for (const x of S) kinds[x.fleet.kind] = (kinds[x.fleet.kind] ?? 0) + x.fleet.boats;
    return { ok: boats > 0 && short.hull > 0 && short.hull < S.length, lines: [`${boats} boats (${Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(", ")}), ${wrights} shipwrights`, `more than half short of their ships' stores: hull ${short.hull}, fastenings ${short.fasten}, sail ${short.sail} peoples (trade for them)`] };
  },
  rooms() {
    // every room of the table in every people's materials: built, furnished, lit, every law kept, every block vanilla
    const bad = [], odd = new Set(); let n = 0;
    for (const t of Object.keys(MATS)) for (const sym of Object.keys(PTABLE)) { const r = roomVox(sym, t); n++; if (r.checks.length) bad.push(`${t} ${sym}: ${r.checks.join(", ")}`); for (const v of r.vox.values()) if (!exists(v.id)) odd.add(v.id); }
    return { ok: !bad.length && !odd.size, lines: [`${n} rooms built (${Object.keys(PTABLE).length} elements x ${Object.keys(MATS).length} peoples): ${bad.length} breaking a law${bad.length ? ": " + bad.slice(0, 5).join("; ") : ""}${odd.size ? `; not vanilla: ${[...odd].join(", ")}` : ""}`] };
  },
  periodic() {
    // the table of rooms: every household, 2 to 13 beds, with and without work, under every backbone, fits with no law broken
    const lines = [], broken = []; let n = 0;
    for (const law of ["chain", "hall", "court"]) for (let beds = 2; beds <= 13; beds++) for (const work of [0, 1]) { const m = assemble(formulaOf({ beds, work, stores: 2 }, law)); n++; if (m.problems.length) broken.push(`${law} ${beds}${work ? "+work" : ""}: ${m.problems[0]}`); }   // vision: the households the sim has
    let stacked = 0; for (const t of Object.keys(STOREYS)) for (let beds = 2; beds <= 13; beds++) for (const work of [0, 1]) for (const shop of [false, true]) for (const skinny of [false, true]) { const st = fitStack({ beds, work, stores: 2 }, t, { shop, skinny }); n++; if (st.floors.length > 1) stacked++; if (st.molecule.problems.length) broken.push(`${t} ${beds}: ${st.molecule.problems[0]}`); }   // every people's houses, stacked by elevation
    const T = Object.values(PTABLE), joins = {}; for (const a of T) for (const b of T) joins[joinOf(a.sym, b.sym)] = (joins[joinOf(a.sym, b.sym)] ?? 0) + 1;
    lines.push(`${T.length} rooms, one an element (${T.map((t) => `${t.sym} ${t.room}`).join(", ")})`);
    lines.push(`joins between them: ${Object.entries(joins).map(([k, v]) => `${v} ${k}`).join(", ")}; ${n} households fitted (${stacked} of them on more than one storey), ${broken.length} breaking a law${broken.length ? ": " + broken.slice(0, 5).join("; ") : ""}`);
    const two = assemble(formulaOf({ beds: 5, work: 1, stores: 2 }, "chain")); lines.push(`e.g. five beds and a workshop: ${two.formula.join("-")}, ${two.doors.length} doors, ${two.windows.length} windows`);
    return { ok: !broken.length, lines };
  },
  async theracity() {
    world();
    // Thera remapped: the caldera the Therans', the outer slope in the plan's equal shares (world/theraplan.js)
    const S = useSectors(peoples().list), kinds = {}; (await import("../world/theraplan.js")).usePeoples(S);
    for (let v = -2800; v <= 2800; v += 40) for (let u = -2800; u <= 2800; u += 40) { const p = theraPlan(u, v); if (p.kind === "caldera" || p.kind === "outer") { const key = p.kind === "caldera" ? `caldera ${p.culture}` : `outer ${p.culture}`; kinds[key] = (kinds[key] ?? 0) + 1; } }   // vision: a sample every 20 blocks
    const off = S.map((q) => Math.abs((Math.atan2(Math.sin(q.home - q.mid), Math.cos(q.home - q.mid)) * 180) / Math.PI));
    const outerPeoples = new Set(Object.keys(kinds).filter((k) => k.startsWith("outer")).map((k) => k.slice(6)));
    return { ok: !!kinds["caldera therans"] && S.every((q) => outerPeoples.has(q.tradition)) && !outerPeoples.has("therans"), lines: [`${S.length} peoples on the outer slope (theraplan lens: their shares and bearings): ${S.map((q) => q.tradition).join(", ")}`, `samples: ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(", ")}`] };
  },
  loop() {
    // the feedback loop's own laws: every knob on its ladder; the history undoes back to the first rungs, one rung a step
    const bad = Object.keys(LADDERS).filter((k) => !LADDERS[k].includes(CALIBRATION[k]));
    let back = { ...CALIBRATION }, jumps = 0; for (const h of [...CAL_HISTORY].reverse()) for (const k of Object.keys(h.from)) { if (Math.abs(LADDERS[k].indexOf(h.from[k]) - LADDERS[k].indexOf(h.to[k])) > 1) jumps++; back[k] = h.from[k]; }
    return { ok: !bad.length && !jumps, lines: [`${Object.keys(LADDERS).length} knobs: ${Object.entries(CALIBRATION).map(([k, v]) => `${k} ${v}`).join(", ")}; ${CAL_HISTORY.length} steps taken${bad.length ? `; off their ladders: ${bad.join(", ")}` : ""}${jumps ? `; ${jumps} steps of more than a rung` : ""}`, `undone, they return to: ${Object.entries(back).map(([k, v]) => `${k} ${v}`).join(", ")}`] };
  },
  folk() {
    world();
    const P = peoples().list, socs = P.map((p) => societyOf(p));
    const p = P.find((q) => q.living === "fishers"), s = socs[P.indexOf(p)];
    const onDay = (yr, hourTick) => yr + ((((hourTick - yr) % RUNGS.sky) + RUNGS.sky) % RUNGS.sky);   // the first tick at that hour from then
    const at = (part, season) => { const hourTick = { dawn: 0, morning: 3000, afternoon: 8000, dusk: 12000, night: 18000 }[part], yr = Math.round({ summer: 0, winter: 0.5 }[season] * YEAR_TICKS); return whereAt(p, s, onDay(yr, hourTick)); };   // vision: hours and seasons to show
    const sum = (o) => ["home", "work", "docks", "market", "sea", "thera"].reduce((a, k) => a + o[k], 0);
    const a = at("morning", "summer"), b = at("night", "winter");
    const r1 = rosterAt(s, 0, p.tradition), r2 = rosterAt(s, RUNGS.sky, p.tradition), r0 = rosterAt(s, RUNGS.sky - 1, p.tradition), rv = rosterAt(s, 0, p.tradition, 1);
    const count = (r) => { const m = {}; for (const x of r) m[x.role] = (m[x.role] ?? 0) + 1; return JSON.stringify(Object.entries(m).sort()); };
    const changed = r1.filter((x, k) => x.role !== r2[k].role).length, steadyDay = r1.every((x, k) => x.role === r0[k].role), visit = r1.filter((x, k) => x.role !== rv[k].role).length;
    const crowdS = Object.values(theraCrowd(P, socs, 3000)).reduce((x, y) => x + y, 0), crowdW = Object.values(theraCrowd(P, socs, onDay(Math.round(0.5 * YEAR_TICKS), 3000))).reduce((x, y) => x + y, 0);   // vision: a summer and a winter morning
    const ok = sum(a) === s.folk && sum(b) === s.folk && count(r1) === count(r2) && changed > 0 && steadyDay && visit > 0 && crowdS > crowdW;
    return { ok, lines: [`a fishing people's ${s.folk} folk, a summer morning: ${["home", "work", "docks", "market", "sea", "thera"].map((k) => `${k} ${a[k]}`).join(", ")}; a winter night: ${["home", "work", "docks", "market", "sea", "thera"].map((k) => `${k} ${b[k]}`).join(", ")}`,
      `each keeps its role all day (${steadyDay}); next day ${changed} of ${s.folk} take new roles, a player's arrival turns ${visit}, every role still filled (${count(r1) === count(r2)}); dressed as ${r1[0].dress} villagers`, `Thera's crowd from the world: ${crowdS} on a summer morning, ${crowdW} on a winter one`] };
  },
  pirates() {
    world();
    const n = 12, recs = monthRecords(n), w = firstWorld(), L = loop(), lines = [];   // vision: a year
    let ok = true, last = null;
    for (let m = 0; m < n; m++) {
      runEra(w, null, RUNGS.month); w.record = recs[m].slice();
      const b = bake(w), bands = bandsIn(m, recs, b);
      ok &&= bands.sailing.length <= Math.round(BOUNDS.PIRATES * L.length);
      const tiers = {}; for (const x of bands.sailing) tiers[x.era] = (tiers[x.era] ?? 0) + 1;
      if (m % 3 === 2) lines.push(`month ${m + 1}: ${bands.sailing.length} bands sailing (${Object.entries(tiers).map(([k, v]) => `${v} ${k}`).join(", ") || "none"}), ${bands.kept} kept in port by the Therans`);   // vision: a line a season
      last = bands.sailing[0] ?? last;
    }
    if (last) { const a = bandAt(last, 0), c = bandAt(last, 6000); lines.push(`  e.g. the ${last.era} of ${last.home}: a ${a.beats}-beat round trip; at sunrise ${Math.round(a.f * 100)}% along, at noon ${Math.round(c.f * 100)}%`); }   // vision: two moments
    return { ok, lines };
  },
  continuance() {
    world();
    const L = loop(), trad = (i) => L[i].tradition;
    // a world pushed out of bounds: one tradition all rising, the world two-thirds rising
    const bad = L.map((p, i) => (p.tradition === "norse" ? 1 : i % 3 === 0 ? -1 : 1));   // vision: a lopsided record
    const c = continuance(bad, trad), back = undo(c.record, c.log);
    const m = (r) => { const t = {}; r.forEach((v, i) => { (t[trad(i)] ??= []).push(v); }); return Math.max(...Object.values(t).map((v) => Math.abs(v.reduce((a, b) => a + b, 0) / v.length))); };
    const b0 = recBalance(bad), b1 = recBalance(c.record);
    monthRecords(48); const logs = continuanceLogs().slice(0, 4).map((l) => l.length);   // vision: four real years
    const ok = m(c.record) <= BOUNDS.TRADITION + 1e-9 && b1.up <= BOUNDS.THIRDS[1] + 1e-9 && JSON.stringify(back) === JSON.stringify(bad);
    return { ok, lines: [`a lopsided world (the most out tradition at ${m(bad).toFixed(2)}, rising ${(b0.up * 100).toFixed(0)}%) is held to ${m(c.record).toFixed(2)} and ${(b1.up * 100).toFixed(0)}% in ${c.log.length} moves; undone exactly: ${JSON.stringify(back) === JSON.stringify(bad)}`, `in the real world's first four years the Therans moved ${logs.join(", ")} times`] };
  },
  homeport() {
    world();
    const out = [];
    let ok = true;
    for (const t of ["norse", "japanese", "pacific"]) {
      const S = styleOf({ tradition: t }), port = newPort(S);
      for (let d = 0; d < 40; d++) { deliver(port, { [S.wall]: 60, [S.post]: 14, [S.roof]: 40, [S.stone]: d > 12 ? 140 : 0, "minecraft:iron_ingot": 8 }, 60); portDay(port, 1); }   // vision: a steady player's basket
      ok &&= port.stage >= 3 && [S.wall, S.post, S.roof, S.stone].every((id) => exists(id));
      out.push(`${S.name} (${[S.wall, S.post, S.roof].map((x) => x.replace("minecraft:", "")).join(", ")}): ${port.log.map((l) => `${l.stage} day ${l.day}`).join(", ")}; ${port.folk} folk, ${STAGES[port.stage].berths} berths`);
    }
    return { ok, lines: out };
  },
  breathing() {
    // what runs, how often, and where: the world's compute, by rung and distance
    const L = loop().length;
    const rows = [["boats near a player", "tick", "rendered"], ["waves, tide, wind, gusts", "asked", "anywhere"], ["the record: realms' pulse and peoples' fortunes", "day (400 ticks)", `${REALMS} + ${L} trits`], ["folk: where and who", "asked (roles turn each beat)", "where a player is"],
      ["buildings: what stands, what's going up", "asked (re-baked a month)", "anywhere"], ["borders, tempers, pirates, quarters", "month", "the world"], ["the Therans' continuance", "year", "the world"], ["pirate bands' places", "asked", "anywhere"], ["a player's home port", "sky day", "one"]];
    const perTick = (REALMS + L) / RUNGS.day;
    return { ok: perTick < 2, lines: [...rows.map((r) => `${r[0].padEnd(48)} ${r[1].padEnd(30)} ${r[2]}`), `steady load beyond the player's boats: ${perTick.toFixed(2)} trit-steps a tick (${REALMS + L} a day); a month's re-bake and a year's continuance, then read off the clock`] };   // vision: under two a tick
  },
  economy() {
    world();
    const R = economy(24), g = ledger(R), ev = {}; for (const e of R.events) ev[e.what] = (ev[e.what] ?? 0) + 1;   // vision: two years
    const cross = R.events.filter((e) => e.ruinOf && e.ruinOf !== e.who).length;
    const tiers = {}; for (const s of R.state) tiers[s.tier] = (tiers[s.tier] ?? 0) + 1;
    const ok = Math.abs(g.gap) < 1e-3 * Math.max(1, g.in / 1e6) && (ev.razed ?? 0) > 0 && (ev["re-founded on a ruin"] ?? 0) > 0;   // vision: float rounding over millions of items
    return { ok, lines: [`two years: ${Math.round(g.in).toLocaleString()} items came into being (${Math.round(g.made).toLocaleString()} made, ${Math.round(g.allotted ?? 0).toLocaleString()} allotted to the Koinon, ${Math.round(g.minted ?? 0).toLocaleString()} emeralds minted); every one is accounted for (gap ${g.gap.toExponential(1)}): eaten ${Math.round(g.eaten).toLocaleString()}, used ${Math.round(g.used).toLocaleString()}, rotted ${Math.round(g.rot).toLocaleString()}, in stores ${Math.round(g.stock).toLocaleString()}, standing ${Math.round(g.standing).toLocaleString()}, at Thera's Exchange ${Math.round(g.exchange).toLocaleString()}, in ruins ${Math.round(g.ruins).toLocaleString()}, afloat (markets, wrecks, hoards, kits) ${Math.round(g.afloat.total).toLocaleString()}, gone to the sea ${Math.round(g.sea).toLocaleString()}`,
      `events: ${Object.entries(ev).map(([k, v]) => `${k} ${v}`).join(", ")} (${cross} on another people's ruin); towns now: ${Object.entries(tiers).map(([k, v]) => `${v} ${k}s`).join(", ")}`] };
  },
  settlement() {
    world();
    const R = economy(12), L = loop(), i = R.state.findIndex((s) => s.plan.some((b, k) => s.built[k] && /palisade|wall/.test(b.name))), p = L[i], s = R.state[i];   // vision: a year in
    const full = layout(p, s.site, s.plan, s.built), less = s.built.map((x, k) => x && k < s.built.lastIndexOf(true)), shrunk = layout(p, s.site, s.plan, less), again = layout(p, s.site, s.plan, s.built);
    const same = JSON.stringify([...full.owner.entries()].map(([q, d]) => `${q.i},${q.j}:${d}`).sort()) === JSON.stringify([...again.owner.entries()].map(([q, d]) => `${q.i},${q.j}:${d}`).sort());
    // the wall closes: every walled plot's neighbours are walled, wall, water or harbour
    const walledKeys = new Set([...full.owner.entries()].filter(([, d]) => ["homes", "civic", "market", "crafts"].includes(d)).map(([q]) => `${q.i},${q.j}`)), wk = wallKeys(full);
    let open = 0; for (const q of full.grid.plots) if (walledKeys.has(`${q.i},${q.j}`)) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = full.grid.at.get(`${q.i + a},${q.j + b}`), k = `${q.i + a},${q.j + b}`; if (n && !n.water && !walledKeys.has(k) && !wk.has(k) && full.owner.get(n) !== "harbour") open++; }   // given: the four neighbours
    const ok = same && open === 0 && full.walls.length > 0;
    return { ok, lines: [`${p.key} (${p.tradition}): districts ${Object.entries(full.counts).map(([k, v]) => `${k} ${v}`).join(", ")}; wall ${full.walls.length} plots, ${full.gates.length} gates, closed: ${open === 0}`, `one building fewer: ${Object.values(shrunk.counts).reduce((a, b) => a + b, 0)} plots, wall ${shrunk.walls.length}; grown back, the very same town: ${same}`] };
  },
  observer() {
    world();
    const t = 7000, o = observePeople("norse", t), v = observeVillager(o.who.split(":")[0], 3, t), pl = observePlace(16384, 4800, t);   // vision: a moment to look at
    return { ok: !!o.doing && !!v.role && !!pl.ground, lines: [`${o.who}: ${o.doing} (${o.why.join("; ")}), goal ${o.goal}, ${o.built.split(":")[0]} built`, `its villager #3: ${v.role}, ${v.at}, dressed as a ${v.dress}`, `a place: ${pl.ground}, wind ${pl.wind}`] };
  },
  ambient() {
    world();
    const o = observePeople("norse", 2000), t2 = observePeople("norse", 18000);   // vision: a morning and a night
    const load = new Array(RUNGS.day).fill(0); for (let k = 0; k < RUNGS.day; k += RUNGS.beat) load[k] += 3; load[0] += 5;   // vision: the day's own work: the record on its tick, the folk on their beats
    const g = fillGaps(load, AMBIENT.map((a) => ({ name: a.name, period: Math.min(RUNGS.day, RUNGS[a.rung]), cost: 1 })));   // vision: a unit of work each
    return { ok: g.after <= g.before, lines: [`a morning: ${Object.entries(o.life).map(([k, v]) => `${k} ${v}`).join(", ") || "quiet"}`, `a night: ${Object.entries(t2.life).map(([k, v]) => `${k} ${v}`).join(", ") || "quiet"}`, `the gap filler lays ${AMBIENT.length} kinds of life into the day's quiet ticks: peak ${g.before} before, ${g.after} after`] };
  },
  waves() {
    const H = (w) => waveMax(seaStateOf(w).Hs);
    const mono = [2, 4, 6].every((b, k, a) => k === 0 || waveDamage(H(16), b) <= waveDamage(H(16), a[k - 1]));   // vision: stronger stands better
    const calm = waveDamage(H(7), 3, 0.4) === 0;
    const s = boatAt({ x: xOfLon(-30), z: zOfLat(48), heading: 160, L: 8 }), f = boatAt({ x: xOfLon(-30), z: zOfLat(48), heading: 160, L: 8 });   // vision: a boat in the westerlies
    for (let t = 0; t < 1200; t++) { step(s, OPS, { t, helm: 0, sail: true, h: s.h, waves: true }); step(f, OPS, { t, helm: 0, sail: true, h: f.h, waves: false }); }   // vision: a minute
    const sea = seaOnHull(s, s.h, 1200), slower = project(s).speed < project(f).speed;
    const r = boatAt({ x: xOfLon(-30), z: zOfLat(48), heading: 160, L: 8, keep: 2000 }), r0 = bits(r, KEYS), cx = (t) => ({ t, helm: Math.sin(t / 50), sail: true, h: r.h, waves: true });   // vision: a helm at work
    for (let t = 0; t < 800; t++) step(r, OPS, cx(t)); for (let t = 799; t >= 0; t--) unstep(r, OPS, cx(t));   // vision: forty seconds
    const back = bits(r, KEYS) === r0;
    return { ok: mono && calm && slower && back, lines: [`in the sea, helm at work, 800 ticks run back exactly: ${back}`,`a blow's worst wave ${H(16).toFixed(1)} m wrecks a month: planks ${(waveDamage(H(16), 3) * 100).toFixed(0)}%, stone ${(waveDamage(H(16), 6) * 100).toFixed(0)}% (open shore); the trades never hurt a sheltered harbour: ${calm}`,
      `an 8-block boat in the westerlies: ${project(f).speed.toFixed(2)} m/s in flat water, ${project(s).speed.toFixed(2)} in the sea; heave ${sea.heave.toFixed(2)} m, pitch ${(sea.pitch * 180 / Math.PI).toFixed(1)} deg, wear ${project(s).wear.toFixed(1)}`] };
  },
  textures() {
    const N = TEXTURE.N, F = TEXTURE.WATER_FRAMES; let tile = 0, loop = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let f = 0; f < F; f++) {
      tile = Math.max(tile, Math.abs(waterAt(x + N, y, f) - waterAt(x, y, f)), Math.abs(waterAt(x, y + N, f) - waterAt(x, y, f)));
      loop = Math.max(loop, Math.abs(waterAt(x, y, f + F) - waterAt(x, y, f)));
    }
    const S = stringFrames(N), same = (a, b) => a.every((v, i) => v === b[i]);
    let first = 0; for (let t = 1; t < S.length && !first; t++) if (same(S[t], S[0])) first = t;
    const peak = Math.max(...S.map((g) => g.reduce((a, v) => a + (v !== 0), 0)));
    const sl = Object.values(sailTex()).map((t) => Buffer.from(t.d).toString("base64")), distinct = new Set(sl).size === sl.length;
    const ids = simBlocks(), fams = {}; const t0 = performance.now(); for (const id of ids) { tileOf(id); fams[lookOf(id).family] = (fams[lookOf(id).family] ?? 0) + 1; } const made = performance.now() - t0;
    const t1 = performance.now(); let z = 0; for (let k = 0; k < 1e5; k++) z += texel(ids[k % ids.length], (k % 16) / 16, ((k >> 4) % 16) / 16)[0]; const per = ((performance.now() - t1) / 1e5) * 1e6;   // vision: a hundred thousand lookups
    // sets: where two variants meet, the step across the seam against the step between neighbouring pixels inside (1: no seam shows)
    const px = (t, u, v) => [0, 1, 2].map((c) => t.rgb[(v * N + u) * 3 + c]), dif = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    let seam = 0, inner = 0, ns = 0; const loose = ids.filter((id) => variantsOf(id) > 1);
    for (const id of loose.filter((_, i) => i % 4 === 0)) for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) {   // vision: a sample: a block in four, six variants (every layer's every variant)
      const A = tileOf(id, 0, "side", a), B = tileOf(id, 0, "side", b); for (let v = 0; v < N; v++) { seam += dif(px(A, N - 1, v), px(B, 0, v)); inner += dif(px(A, N - 2, v), px(A, N - 1, v)); ns++; } }
    // corners: the top's edge row against the side's top row (one field, so they meet), against two unrelated rows
    let edge = 0, other = 0, ne = 0; const solid = ids.filter((id) => facesOf(id).length > 1 && lookOf(id).family !== "grass");
    for (const id of solid) { const T = tileOf(id, 0, "top"), S2 = tileOf(id, 0, "side"); for (let u = 0; u < N; u++) { edge += dif(px(T, u, 0), px(S2, u, 0)); other += dif(px(T, u, N / 2), px(S2, u, N / 2)); ne++; } }
    const seamR = seam / inner, edgeR = edge / other;
    const ok = tile < 1e-9 && loop < 1e-9 && first === STRING_FRAMES && distinct && z > 0 && seamR < 1.6;   // vision: a seam no worse than a little over the texture's own grain
    return { ok, lines: [`water: the ${N}-pixel tile wraps exactly (seam ${tile.toExponential(1)}) and its ${F} frames loop exactly (${loop.toExponential(1)}): one breath`,
      `prismarine runs the 5D string: first back at the point at frame ${first} (3n = ${STRING_FRAMES}), at most ${peak} cells lit (a line in the plane)`,
      `${ids.length} block textures in ${Object.keys(fams).length} families, made once in ${made.toFixed(0)} ms; after that the sim sees a texel in ${per.toFixed(0)} ns (one lookup)`,
      `sets: ${loose.length} blocks in ${VARIANTS} variants (three layers, ${TEXTURE.LAYERS.join(" x ")}); across any two variants' seam the step is ${seamR.toFixed(2)} x a step inside (1 is seamless)`,
      `corners: ${solid.length} solid blocks; where top meets side the step is ${edgeR.toFixed(2)} x that between unrelated rows (one field round the corner)`,
      `sails: ${sl.length} traditions, each its own row of the golden line's breath: all distinct ${distinct}`] };
  },
  trade() {
    world();
    const R = economy(24), F = R.flows, net = R.net, tiers = {}, firsts = {};   // vision: two years
    for (const n of net.nodes.values()) { const t = n.key === "thera" ? "Thera" : n.league ? "the Koinon" : ["culture", "city", "island hub", "continental hub"][n.tier]; tiers[t] = (tiers[t] ?? 0) + 1; }
    for (const o of net.of.values()) { const t = o.league ? "the Koinon" : o.first.key === "thera" ? "Thera's own" : ["", "a city", "an island hub", "a continent directly"][o.first.tier]; firsts[t] = (firsts[t] ?? 0) + 1; }
    const Lg = league(), kitsHeld = Object.entries(R.kits).map(([k, v]) => `${k} ${v.count}`).join(", "), fitted = R.state.filter((s) => s.kits && Object.values(s.kits).some((n) => n > 0.5)).length, short = Lg.states.filter((st) => st.short).map((st) => `${st.name} (${st.short.join(", ")})`);
    const wr = R.wrecks, causes = {}; for (const w of wr) { const c = /contested/.test(w.cause) ? "contested waters" : /pirates/.test(w.cause) ? "pirates" : /loot/.test(w.cause) ? "sunk loot" : /raided/.test(w.cause) ? "raids at the shore" : "the sea"; causes[c] = (causes[c] ?? 0) + 1; }
    const sumI = (m) => Object.values(m).reduce((a, b) => a + b, 0), hoard = R.hoards.reduce((a, h) => a + sumI(h.items), 0), k = (x) => Math.round(x).toLocaleString();
    const share = F.toThera / Math.max(1, F.up[0] + F.culture);
    const ok = F.up[0] > 0 && F.up[1] > 0 && F.toThera > 0 && share < 0.2 && wr.length > 0 && Object.keys(R.kits).length > 0;   // vision: only a small share of trade should be international
    return { ok, lines: [`tiers: ${Object.entries(tiers).map(([t, v]) => `${v} ${t}${v > 1 ? "s" : ""}`).join(", ")}; peoples sell first to ${Object.entries(firsts).map(([t, v]) => `${t} ${v}`).join(", ")}`,
      `the last month, up: ${k(F.up[0])} items from villages and towns to their markets (and ${k(F.culture)} of their own materials to their cultural hubs), ${k(F.up[1])} from cities up, ${k(F.up[2])} from island hubs up, ${k(F.up[3])} from continents; of it, to Thera ${k(F.toThera)} (${(share * 100).toFixed(1)}%, the international)`,
      `down: ${k(F.down[0])} to the peoples, ${k(F.down[1] + F.down[2])} back to cities and island hubs, ${k(F.fromThera)} from Thera; open orders at Thera ${k(F.orders)} items`,
      `the Koinon (${Lg.states.length} city-states, neutral, the money people): ${presiding(R.month - 1).name} presides; each state its own market, levelled and circulating (${k(F.league?.circulated ?? 0)} moved), ${k(F.league?.smelted ?? 0)} iron smelted, ${k(F.league?.allotted ?? 0)} allotted on the tempo; its house at Thera holds ${k(F.league?.coin ?? 0)} emeralds (worth ${k(F.league?.reserve ?? 0)} items with its goods) and bought ${k(F.league?.bought ?? 0)}; kits at Thera: ${kitsHeld || "none"}; ${fitted} peoples sail with fitted pieces${short.length ? "; short: " + short.join("; ") : "; no state short of its stuff"}`,
      `Thera: the Therans ate ${k(F.therans?.ate ?? 0)} and used ${k(F.therans?.timber ?? 0)} logs and planks from the Exchange first; the Koinon's house, striking ${k(F.therans?.minted ?? 0)} emeralds this month (topping its house up to a month's worth, ${MINT}), bought ${k(F.therans?.bought ?? 0)} for them from the markets (left hungry: ${((F.therans?.hungry ?? 0) * 100).toFixed(0)}%); the Koinon's brokerage on the market ${k(F.brokerage ?? 0)}`,
      `wrecks: ${wr.length} on the sea holding ${k(wr.reduce((a, w) => a + sumI(w.items), 0))} items (${Object.entries(causes).map(([c, v]) => `${v} from ${c}`).join(", ")}); pirates' hoards ${R.hoards.length}, ${k(hoard)} items buried`] };
  },
  explorers() {
    world();
    const X = explorers(), R = economy(24), t = 24 * RUNGS.month * RUNGS.day, ships = X.ships.map((s) => ({ s, p: explorerAt(s, t) }));   // vision: two years in
    const a = ships[0], here = meet(a.p.x + 40, a.p.z, t), ch = ships.map(({ s }) => chartOf(s, t, R)), kinds = {}; for (const c of ch) for (const m of c.marks) kinds[m.kind] = (kinds[m.kind] ?? 0) + 1;   // vision: a player 40 blocks off
    const T0 = performance.now(); for (let k = 0; k < 1000; k++) meet(a.p.x, a.p.z, t + k * 100); const per = (performance.now() - T0) / 1000;   // vision: a thousand beats
    const ok = ships.length === EXPLORE.SHIPS && here.some((h) => h.s === a.s) && ch.some((c) => c.marks.length > 1);
    return { ok, lines: [`${ships.length} explorers at sea; two years in, ${a.s.name} is on round ${a.p.round}, leg ${a.p.leg} of ${EXPLORE.LANDFALLS + 1}, at (${Math.round(a.p.x)}, ${Math.round(a.p.z)})`,
      `a player 40 blocks off meets ${here.map((h) => h.s.name).join(", ")}; the check costs ${(per * 1000).toFixed(0)} us a beat against all ${ships.length}`,
      `their charts now: ${Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(", ")} marks; e.g. ${ch.find((c) => c.marks.some((m) => m.kind === "wreck"))?.marks.find((m) => m.kind === "wreck")?.name ?? "no wrecks on their courses yet"}`] };
  },
  dwellings() {
    world();
    const L = loop(), e = L.find((q) => q.tradition === "european"), theran = theranPeople(e);
    let n = 0, ok = 0, lamps = 0, bad = []; const bad2 = [];
    for (const t of Object.keys(HOUSE_FORM)) { const p = t === "therans" ? theran : L.find((q) => q.tradition === t); if (!p) continue; for (const k of [2, 3, 5, 8]) for (const dense of [false, true]) for (const vary of [{}, { mirror: true, porch: true }]) { const h = houseOf(p, { n: k, job: "fisherman", tradition: t, dense, vary }); n++; if (h.checks.ok) ok++; else bad.push(`${t} ${k}`); lamps += h.lamps.length; for (const b of h.vox.values()) if (!exists(b.id)) bad2.push(b.id); } }   // vision: households of two to eight
    return { ok: ok === n && !bad2.length, lines: [`${n} houses (${Object.keys(HOUSE_FORM).length} cultures, households 2 to 8, open and dense, plain and varied): ${ok} meet every need (a bed a villager, the workstation, store, fire and table, all reached from the door, every floor at light 8, with ${lamps} lanterns hung where it was dark)${bad.length ? "; short: " + bad.slice(0, 6).join(", ") : ""}`,
      `every block vanilla: ${!bad2.length}${bad2.length ? " (" + [...new Set(bad2)].join(", ") + ")" : ""}; roundness by culture ${Object.entries(ROUNDNESS).map(([k, v]) => `${k} ${v}`).join(", ")}`] };
  },
  chem() {
    world();
    const L = loop(), R = economy(1), out = [];
    let ok = true;
    for (const t of ["norse", "japanese"]) { const land = (k) => plotsAt(R.state[k].site).plots.filter((q) => !q.water).length, ks = L.map((q, k) => k).filter((k) => L[k].tradition === t), i = ks.reduce((a, k) => (land(k) > land(a) ? k : a), ks[0]), p = L[i], c = compound(p, R.state[i].site, 300), r = reaction(p, R.state[i].site, 200, 300); const beds = c.houses.reduce((a, h) => a + h.n, 0); ok = ok && beds >= 300 && r.prefix; const kinds = {}; for (const s2 of c.steps) kinds[s2.what] = (kinds[s2.what] ?? 0) + 1; out.push(`${t} (its roomiest site), a town of 300: ${Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(", ")}; ${beds} beds; 200 -> 300 is ${r.steps.length} steps of synthesis and the smaller town a prefix of the larger: ${r.prefix} (decline undoes it exactly)`); }   // vision: two towns of three hundred
    return { ok, lines: out };
  },
  boxes() {
    world();
    const L = loop(), R = economy(1), P = populations(), t0 = performance.now(); let short = 0, q = 0, hh = 0, walls = 0, dense = 0;
    L.forEach((p, i) => { const v = P.get(p.key), T = townOf(p, R.state[i].site, v.pop, v.tier); short += T.short; q += T.quarters; hh += T.households; if (T.wall) walls++; dense += T.boxes.filter((b) => b.storeys).length; });
    const ms = performance.now() - t0, tiers = {}; let tot = 0; for (const v of P.values()) { tiers[v.tier] = (tiers[v.tier] ?? 0) + 1; tot += v.pop; }
    const T = theraBoxes();
    return { ok: short === 0, lines: [`${tot.toLocaleString()} folk in ${P.size} settlements: ${Object.entries(tiers).map(([k, v]) => `${v} ${k}s`).join(", ")} (market towns draw a phi^-3 share of their villages, continental hubs phi^-2 of their cities)`,
      `as boxes: ${hh.toLocaleString()} households in ${q} quarters (${dense} densified a storey or two), ${walls} walled towns, ${short} households without ground; the whole world laid out in ${ms.toFixed(0)} ms`,
      `Thera: ${T.docks} dock quarters (each of its culture, two storeys) and ${T.theran} Theran quarters on the cone: ${T.households} households`] };
  },
  folk() {
    world();
    // every people's pinnacle meets its house's needs on every storey; every skin painted; every people dressed and named
    const L = loop(), eu = L.find((q) => q.tradition === "european"), theran = theranPeople(eu);   // vision: the Therans as the pack draws them
    const lines = [], bad = [];
    for (const t of Object.keys(PINNACLE)) { const p = t === "therans" ? theran : L.find((q) => q.tradition === t); if (!p) continue; const b = pinnacle(p, { tradition: t }); if (!b.house.checks.ok) bad.push(`${t} house`); for (const v of b.vox.values()) if (!exists(v.id)) bad.push(v.id); lines.push(`${t}: ${b.storeys} storeys, ${b.beds} beds, ${floorsOf(b).length} floor cells to stand on`); }
    const skins = []; for (const t of CULTURES) for (let k = 0; k < RANKS.length; k++) skins.push(skinOf({ tradition: t, slot: k }));
    const blank = skins.filter((px) => px.length !== 64 * 64 * 4 || !px.some((v, i) => i % 4 === 3 && v === 255)).length;
    const undressed = CULTURES.filter((t) => !DRESS[t] || !NAMES[t]);
    lines.push(`${SKINS} skins (${CULTURES.length} peoples x ${RANKS.length}, the rulers, the wardens): ${blank} blank; undressed or unnamed: ${undressed.join(", ") || "none"}; cliff builders: ${Object.keys(CLIFF).join(", ")}`);
    if (bad.length) lines.push(`short: ${bad.join(", ")}`);
    return { ok: !bad.length && !blank && !undressed.length && Object.keys(CLIFF).every((t) => PINNACLE[t]), lines };
  },
  underground() {
    world();
    // every province's column: whole from the bedrock to its soil (no gap, no overlap but the caves), vanilla blocks only, ores at the contacts
    const lines = [], bad = new Set(); let ok = true;
    for (const prov of Object.keys(PROVINCES)) {
      let ores = 0, cols = 0, caves = 0, gaps = 0, kinds = new Set();
      for (let k = 0; k < 400; k++) {
        const x = 1000 + k * 37, z = 3000 + k * 53, top = prov === "seafloor" ? 30 : 62 + 8 + (k % 89);   // vision: a sample of columns, tops over the range
        const R = columnRock({ x, z, top }, prov, 100, "minecraft:sand"), seen = new Int8Array(400);
        for (const [y0, y1, id] of R.segs) { if (!exists(id)) bad.add(id); kinds.add(id); for (let y = y0; y <= y1; y++) seen[y + 64]++; }
        for (let y = -63; y < top; y++) if (seen[y + 64] !== 1) gaps++;
        for (const [, id] of R.sets) if (!exists(id)) bad.add(id);
        ores += R.sets.length; caves += R.air.length; cols++;
      }
      ok &&= gaps === 0;
      lines.push(`${prov}: ${kinds.size} rocks (${[...kinds].map((i) => i.replace("minecraft:", "")).join(", ")}); ${(ores / cols).toFixed(2)} ore blocks a column, ${caves} cave stretches in ${cols} columns${gaps ? `; ${gaps} gaps` : ""}`);
    }
    if (bad.size) { ok = false; lines.push(`not vanilla: ${[...bad].join(", ")}`); }
    return { ok, lines };
  },
  sealife() {
    world();
    const R = economy(24), S = R.seaLife, sum = seaSummary(S), cb = { ...coralBook(S), start: seaRegions().list.reduce((a, r) => a + r.K.coral, 0) / ((1 + Math.sqrt(5)) / 2) }, k = (x) => Math.round(x).toLocaleString(), sumI = (m) => Object.values(m).reduce((a, b) => a + b, 0);   // vision: two years
    const L = loop(), clerics = L.reduce((a, p) => a + clericsOf(p), 0), th = theraBoxes(), stocks = Object.entries(sum.stocks).filter(([n, v]) => v.K > 0 && n !== "coral");
    const low = stocks.filter(([, v]) => v.x < v.K * 0.2).map(([n]) => n);   // vision: a stock under a fifth of its capacity is in trouble
    const ok = sum.regions > 100 && stocks.every(([, v]) => v.x > 0) && th.cold.ok && th.temple.ok && Math.abs(cb.held - cb.start) < 1e-6;
    return { ok, lines: [`the sea: ${sum.regions} regions; habitats ${Object.entries(sum.hab).map(([h, n]) => `${h} ${n}`).join(", ")}`,
      `after two years, stocks against capacity: ${stocks.map(([n, v]) => `${n} ${Math.round((100 * v.x) / v.K)}%`).join(", ")}${low.length ? "; in trouble: " + low.join(", ") : ""}`,
      `within the years, at their lowest: ${Object.entries(S.low ?? {}).map(([n, v]) => `${n} ${Math.round(v * 100)}%`).join(", ")}; the Sea Rite at each year's end: ${JSON.stringify(S.lastRite)}`,
      `the reefs' see-saw: the world's coral held at ${cb.held.toFixed(3)} (it began at ${cb.start.toFixed(3)}: kept ${Math.abs(cb.held - cb.start) < 1e-6}); within the years living fell no lower than ${(100 * (S.coralLow ?? 1)).toFixed(0)}% and spawn owed rose to ${(100 * (S.coralSwing ?? 0)).toFixed(0)}%; now ${(100 * cb.living / cb.held).toFixed(0)}% living, ${(100 * cb.bleached / cb.held).toFixed(0)}% bleached, ${(100 * cb.owed / cb.held).toFixed(0)}% owed as spawn, with ${cb.dead.toFixed(3)} of dead reef crumbling; over two years ${S.totals["coral died"] ?? 0} dyings, ${S.totals["coral regrew at home"] ?? 0} regrowths at home and ${S.totals["coral settled from elsewhere"] ?? 0} settlings elsewhere`,
      `the wardens: ${sum.closed} regions closed now, over two years ${Object.entries(S.totals ?? {}).map(([w, n]) => `${n} ${w}`).join(", ")}; their sea tax holds ${k(sumI(R.wardens ?? {}))} items`,
      `the sacred: ${clerics} clerics keep shrines at the waterline; the solar rite gives ${riteStrength().toFixed(1)} C at 45 degrees (${JSON.stringify(rite(1)).slice(0, 90)}), bounded by the reefs (bleaching past ${1} C over a reef's own year)`,
      `the Sea Rite Temple: its conduit's frame ${th.temple.frame} of 42, its water whole (${th.temple.water}), awake ${th.temple.awake}, its blessing over ${th.temple.reach} blocks; its floor lit (${th.temple.dark} dark)`,
      `Thera's Cold House: ${th.cold.floor} floor cells, all lit 8 to ${th.cold.most} by soul lanterns, the pond's ice never above ${th.cold.iceMost} (melts past 11): kept ${!th.cold.melts}`] };
  },
  sight() {
    const R = sightRings(), golden = R.filter((x) => x.mip > 0), mean = golden.reduce((a, x) => a + x.share, 0) / golden.length, spread = Math.max(...golden.map((x) => Math.abs(x.share / mean - 1)));
    const D = detailBudget(0.98), fade = { water: fadesAt(Math.hypot(3, 2)), stone: fadesAt(Math.hypot(2, 5)), bricks: fadesAt(4) };   // vision: the life budget with one player (budget lens); the families' highest wavenumbers
    return { ok: spread < 0.1 && fade.stone > 0, lines: [`rings at Fibonacci chunks ${SIGHT.RINGS.join(", ")}: mips ${R.map((x) => x.mip).join(", ")}`,
      `what the eye takes in per ring: ${R.map((x) => (x.share * 100).toFixed(0) + "%").join(", ")}; past where sight saturates, every golden ring the same (within ${(spread * 100).toFixed(0)}%): the view costs its number of rings, the log of its reach`,
      `light detail on the beat (0.98 ms): ${D.map((x) => x.items).join(", ")} items by ring, ${D[0].perChunk} a chunk at the player down to ${D.at(-1).perChunk} at the edge`,
      `spectrum: stone's finest vein drops out at ring ${fade.stone}, bricks' courses at ${fade.bricks}, the water's trains at ${fade.water}; past that each is drawn by its mean colour`] };
  },
  budget() {
    world();
    const time = (f, n) => { const t0 = performance.now(); for (let k = 0; k < n; k++) f(); return (performance.now() - t0) / n; };
    const w = firstWorld(), recordDay = time(() => tick(w), 200);   // vision: samples
    economy(13); const R0 = economy(13).month; const t0 = performance.now(); economy(R0 + 1); const monthBake = performance.now() - t0;
    const b = boatAt({ x: xOfLon(-30), z: zOfLat(48), heading: 160, L: 8, keep: 50 }); let bt = 0; const boatStep = time(() => step(b, OPS, { t: bt++, helm: 0, sail: true, h: b.h, waves: true }), 400);   // vision: samples
    const B = budget({ recordDay, monthBake, boatStep }, { dayTicks: RUNGS.day, monthTicks: RUNGS.month * RUNGS.day });
    const f = (o) => Object.entries(o).map(([k, v]) => `${k} ${v.toFixed(3)}`).join(", ");
    return { ok: B.onePlayerMs < B.allowance && B.life > 0, lines: [`device: ${B.slice} ms a tick for scripts, ${B.allowance} ms steady allowance (QuickJS, from lab timings x45)`,
      `steady: ${f(B.steady)} = ${B.steadyMs.toFixed(3)} ms a tick`, `one player: ${f(B.perPlayer)} -> ${B.onePlayerMs.toFixed(2)} ms`,
      `worst case, 8 players at once (each: ${f(B.worstPer)}, and ${f(B.deferred)}): ${B.worstMs.toFixed(1)} ms a tick if all of it were done at once; shed (shots capped, bookings on the beat): ${B.shedMs.toFixed(1)} ms ${B.shedFits ? "(fits the slice)" : "(over the slice: the game slows, a spike " + (B.shedMs < 100 ? "under" : "over") + " its 100 ms warning)"}`,
      `left for life on the beat with one player: ${B.life.toFixed(2)} ms a tick`] };
  },
  vanilla() {
    const bad = [];
    for (const b of [...LAND_BIOMES, BEACH]) { for (const id of [...b.wood, ...b.stone, ...b.crops, ...b.wild]) if (!exists(id)) bad.push(id); for (const m of b.herd) if (!mobExists(m)) bad.push(m); }
    for (const b of SEA_BIOMES) { for (const id of b.sea) if (!exists(id)) bad.push(id); for (const m of b.mobs) if (!mobExists(m)) bad.push(m); }
    for (const o of ORES) if (!exists(o.id)) bad.push(o.id);
    world();
    for (const p of peoples().list) for (const id of [p.build.frame.post, p.build.frame.wall, p.build.roof.cover]) if (!exists(id)) bad.push(`${p.key} builds with ${id}`);
    const walk = (o) => (typeof o === "string" ? (o.startsWith("minecraft:") && !exists(o) ? bad.push(`Therans: ${o}`) : 0) : o && typeof o === "object" ? Object.values(o).forEach(walk) : 0);
    walk({ ...THERANS.resources, ...THERANS.akrotiri, ...THERANS.santorini });
    walk(SHIP_STORES_ALL);
    for (const t of TIERS) for (const m of [...t.crew, t.captain]) if (!mobExists(m)) bad.push(`pirates: ${m}`);
    world();
    for (const p of peoples().list.slice(0, 80)) for (const [job, J] of Object.entries(JOBS)) { if (J.at && !exists(J.at)) bad.push(`${job} at ${J.at}`); for (const id of Object.keys(J.makes(p, 1))) if (!exists(id)) bad.push(`${job} makes ${id}`); }   // vision: a sample of peoples
    for (const id of Object.keys(FOOD)) if (!exists(id)) bad.push(`food ${id}`);
    return { ok: !bad.length, lines: [bad.length ? `not vanilla: ${[...new Set(bad)].join(", ")}` : "every resource, mob and building block is vanilla Bedrock's"] };
  },
  async census() {
    const C = await import("../world/census.js"), cov = C.coverage(), lines = [], bad = [];
    for (const t of Object.keys(C.NAMES)) for (const id of Object.keys(C.TYPES)) for (const k of [0, 1, 2]) { const v = C.variantOf(id, t, k * 7, k); if (!v.formula.length) bad.push(`${t} ${id} ${k}`); }
    const sizes = Object.keys(C.TYPES).map((id) => new Set([0, 1, 2].map((k) => C.variantOf(id, "european", 3, k).formula.join(""))).size), varied = sizes.filter((n) => n > 1).length;
    const c = C.censusOf({ t: "european", folk: 400, living: "farmers", temper: "traders" }), homes = c.list.filter((x) => x.kind === "home").reduce((a, x) => a + x.n, 0);
    lines.push(`${cov.types} building types; jobs without a building: ${cov.jobs.join(", ") || "none"}; table rooms unused: ${cov.rooms.join(", ") || "none"}; ${varied} of ${sizes.length} types differ by size`, `a town of 400: ${c.households} households, ${homes} homes, ${c.list.reduce((a, x) => a + x.n, 0)} buildings`);
    return { ok: !cov.jobs.length && !cov.rooms.length && !bad.length && homes === c.households, lines };
  },
  async boats() {
    const B = await import("../world/boatsizes.js"), bad = [];
    for (const [t, F] of Object.entries(B.FLEETS)) for (const ty of F) for (let s = 0; s < FIB_[6]; s++) { const z = B.sizeOf(ty, s); if (z.L < ty.range[0] || z.L > ty.range[1] || z.B < 1 || z.crew < 1 || z.cargo < 1) bad.push(`${t} ${ty.name} seed ${s}: L ${z.L}`); if (z.boathouse && z.L > FIB_[7]) bad.push(`${t} ${ty.name} housed past 21`); }
    const great = Object.entries(B.FLEETS).filter(([, F]) => F.some((x) => x.cls === "great")).map(([t]) => t);
    return { ok: !bad.length, lines: [`every boat's length within its type's range, beam, crew and cargo at least one (13 seeds a type)${bad.length ? ": " + bad.slice(0, 4).join("; ") : ""}`, `great ships: ${great.join(", ")}`] };
  },
  async rings() {
    const R = await import("../mod/scripts/rings.js"), seen = new Set(); let dup = 0;
    const n = 9 * 9; for (let i = 0; i < n; i++) { const k = R.spiral(i).join(","); if (seen.has(k)) dup++; seen.add(k); }
    const ringOk = [...Array(4).keys()].every((r) => [...Array(n).keys()].filter((i) => Math.max(...R.spiral(i).map(Math.abs)) === r).length === (r ? 8 * r : 1));
    const order = [0, 1, 2, 3, 4, 5, 8, 13, 14].map((d) => R.targetAt(d));
    return { ok: !dup && ringOk && order[0] === 3 && order[8] === 0, lines: [`the pregen spiral: ${n} tiles, ${dup} twice, each square ring whole: ${ringOk}`, `levels by distance 0,1,2,3,4,5,8,13,14: ${order.join(" ")} (3 whole, 2 surface and life, 0 the tour's)`, `rings: deep ${R.RINGS.deep}, folk ${R.RINGS.folk} (released past ${R.RINGS.release}), surface ${R.RINGS.surface}; a tile ${R.TILE} x ${R.TILE} chunks, ${R.tourLength(2048, 1024)} tiles for the map`] };
  },
  async theraplan() {
    world();
    const P = await import("../world/peoples.js"), TC = await import("../world/theracity.js"), TP = await import("../world/theraplan.js");
    let ps = P.peoples(); ps = Array.isArray(ps) ? ps : ps.list;
    const plan = TP.usePeoples(TC.useSectors(ps)), spread = Math.max(...plan.shares) - Math.min(...plan.shares);
    const shore = {}; for (let a = 0; a < 2 * Math.PI; a += 0.005) for (let r = 3; r < 16; r += 0.02) { const x = THERA.bay.x + r * Math.cos(a), y = THERA.bay.y + r * Math.sin(a), p = TP.placeAt(x, y); if (p.cls === "waterfront") shore[p.people] = (shore[p.people] ?? 0) + 1; }   // vision: a sweep of the island
    const noShore = plan.seeds.filter((s) => !shore[s.tradition]).map((s) => s.tradition), worst = plan.seeds.reduce((m, s) => Math.max(m, Math.abs(s.off)), 0);
    return { ok: spread < 0.005 && !noShore.length, lines: [`${plan.seeds.length} peoples, each ${(100 / plan.seeds.length).toFixed(1)}% of the outer slope (spread ${(spread * 100).toFixed(2)} points); every one on the sea: ${!noShore.length}${noShore.length ? ` (not: ${noShore.join(", ")})` : ""}`,
      `each region's middle from its homeland's bearing: ${plan.seeds.map((s) => `${s.tradition} ${Math.round((s.off * 180) / Math.PI)}°`).join(", ")} (worst ${Math.round((worst * 180) / Math.PI)}°)`] };
  },
  async tempo() {
    const T = await import("../dist/Waterworld_BP/scripts/tempo.js"), R = await import("../mod/scripts/rings.js"), L = T.tempoLoad();   // the built copy (its core/ is beside it): node tools/buildmod.mjs first
    let most = 0, both = 0; for (let t = 0; t < T.BAR; t++) { const n = T.dueAt(t).length; most = Math.max(most, n); if (n > 1) both++; }
    const led = R.ledChunk(0, 0, 21.6, 0, 16), deepFast = R.targetFor(2, 2, true), deepSlow = R.targetFor(2, 2, false), ahead = R.aheadTile(0, 0, 21.6, 0, 16, 2048, 1024), still = R.aheadTile(0, 0, 4, 0, 16, 2048, 1024);   // given: a flier at 21.6 b/s, a walker at 4
    const ok = !L.off.length && L.planned.peak < L.unplanned.peak && deepFast === R.LEVEL.life && deepSlow === R.LEVEL.deep && led.cx === 4 && ahead && !still;
    return { ok, lines: [`${T.TEMPO.length} duties, every period dividing the ${T.BAR}-tick bar (off the gate: ${L.off.join(", ") || "none"}); phases ${T.TEMPO.map((t) => `${t.name} ${T.PHASES[t.name]}/${t.period}`).join(", ")}`,
      `a bar's busiest tick: ${L.unplanned.peak} all starting on tick 0, ${L.planned.peak} on the plan (mean ${L.planned.mean}); ${both} of ${T.BAR} ticks carry two duties or more, ${most} at most`,
      `in flight: rings led ${R.LEAD} s (21.6 b/s leads ${led.cx} chunks), the deep pass waits past ${R.FAST.toFixed(2)} b/s (fast: ${deepFast}, walking: ${deepSlow}), an area ahead of a flier: ${ahead ? `chunks ${ahead.cx0}..${ahead.cx1}` : "none"}, of a walker: ${still ? "one" : "none"}`] };
  },
  async living() {
    const L = await import("../world/living.js"), Dd = await import("../world/district.js"), { RUNGS } = await import("../core/clock.js");
    const pl = Dd.placeOf({ t: "norse", folk: 40, living: "fishers", temper: "peaceful" }, { seed: 3 }), town = { placed: pl.placed, quay: pl.placed.findIndex((q) => q.id === "boathouse"), market: 0 };
    town.chain = L.chainOf(pl.placed); town.jobs = L.jobsOf(pl.placed);
    const p = { living: "fishers", tradition: "norse" }, soc = { action: "fish", professions: {} }, lines = [], bad = [];
    // the deal adds up, every part of a day; the closed form answers the same asked in any order
    let N = 0; for (let h = 0; h < 24; h += 2) { const t = 5 * RUNGS.day + h * RUNGS.day / 24, T = L.townAt(town, p, soc, t); N = T.N; const sum = Object.values(T.counts).reduce((a, b) => a + b, 0); if (sum !== T.N) bad.push(`deal ${sum} of ${T.N} at hour ${h}`); }
    const t1 = 7 * RUNGS.day + RUNGS.day / 24 + FIB_[5] * FIB_[5], A = L.townAt(town, p, soc, t1), first = A.at(3); L.townAt(town, p, soc, t1 + 9999).at(3); const again = L.townAt(town, p, soc, t1).at(3);
    if (JSON.stringify(first) !== JSON.stringify(again)) bad.push("p(person, t) changed when asked again");
    // a walk never jumps: between ticks a walker moves a walker's pace at most
    let jump = 0; for (let k = 0; k < A.N; k++) for (let dt = 0; dt < RUNGS.beat * FIB_[4]; dt += FIB_[5]) { const a = L.townAt(town, p, soc, t1 + dt).at(k), b = L.townAt(town, p, soc, t1 + dt + FIB_[5]).at(k); if (a.away || b.away || a.place !== b.place) continue; jump = Math.max(jump, Math.hypot(a.x - b.x, a.z - b.z) / FIB_[5]); }
    if (jump > L.PACE + 1e-9) bad.push(`a walker jumped ${jump.toFixed(3)} a tick`);
    // the chain's bounds: any journal of acts keeps the people within them; the settle heals toward the chain
    let j = 0, out = 0; for (let s = 0; s < 377; s++) { j += ((s * 7919) % 23) - 11; const n = L.peopleOf(town.chain, town.chain.homes.length, j); if (n < town.chain.min || n > town.chain.max) out++; if (s % 13 === 0) j = L.settle(j); }
    if (out) bad.push(`${out} states outside the chain`);
    const shown = L.shownAt(A, t1, { x: 0, z: 0 }); if (shown.length > L.BODIES) bad.push(`${shown.length} bodies`);
    lines.push(`a Norse hamlet: ${N} people on a chain of ${town.chain.homes.length} homes (bounds ${town.chain.min}..${town.chain.max}), ${town.jobs.length} workplaces; the deal adds up every two hours; p(person, t) the same asked again; walkers at most ${jump.toFixed(3)} a tick (pace ${L.PACE.toFixed(3)}); 377 acts kept it in its bounds; ${shown.length} of ${A.N} shown at the core (budget ${L.BODIES})`);
    return { ok: !bad.length, lines: bad.length ? [...lines, ...bad] : lines };
  },
  async shipping() {
    world(); const S = (await import("../world/shipping.js")).shipping(), r = S.rows, by = S.by, sum = (f) => r.reduce((a, x) => a + f(x), 0);
    const lines = [`${r.length} peoples: ${sum((x) => x.fleet.boats)} boats needing ${sum((x) => x.hands.need)} hands (${sum((x) => x.hands.short)} short, ${sum((x) => x.hands.idle)} boats idle for want of them); ${sum((x) => x.shore.boathouses)} boathouses, ${sum((x) => x.shore.quay)} blocks of quay`, `yards short of the hulls the fleet wears out: ${r.filter((x) => x.yard.short).length}; routes past the fleet's reach: ${r.filter((x) => x.route.carried !== "its own").length} (the League's ships ${r.filter((x) => x.route.carried === "the League's ships").length}, Theran charters ${r.filter((x) => x.route.carried === "a Theran charter").length})`];
    const bad = r.filter((x) => x.fleet.boats < 1 || x.hands.need < x.fleet.crew || !isFinite(x.yard.raise));
    return { ok: !bad.length, lines };
  },
  async drawing() {
    const R = await import("../world/render.js"), L = await import("../world/living.js"), Dd = await import("../world/district.js"), { RUNGS } = await import("../core/clock.js");
    const pl = Dd.placeOf({ t: "european", folk: 90, living: "farmers", temper: "wary" }, { seed: 5 });
    let blocks = 0; const ops = []; pl.placed.forEach((q, i) => { blocks += q.b.vox.size; ops.push(...R.buildingOps(q.b.vox, { x: q.x, y: 0, z: q.z }, `${q.id}:${i}`, q.k)); });
    const b = R.costOf(ops), lay = Dd.layPlace(pl, "european", { wall: true });
    const ground = [], sets = []; for (const [k, v] of lay.vox) { const [x, y, z] = k.split(",").map(Number); if (/grass_block|dirt|cobblestone|stone_bricks/.test(v.id) && y >= 0 && y <= 1) ground.push({ x, z, top: y, id: v.id }); else if (/lantern|flower|pot|barrel/.test(v.id)) sets.push([x, y, z, v.id, v.s]); }
    const f = R.costOf(R.fillOps(ground)), li = R.costOf(R.listOps(sets));
    const town = { placed: pl.placed, quay: 0, market: Math.max(0, pl.placed.findIndex((q) => /market/.test(q.id))) }; town.chain = L.chainOf(pl.placed); town.jobs = L.jobsOf(pl.placed);
    const t = 4 * RUNGS.day + RUNGS.day / 2, T = L.townAt(town, { living: "farmers", tradition: "european" }, { action: "build", professions: {} }, t), shown = L.shownAt(T, t, { B: T.N }), people = R.costOf(R.peopleOps(shown));
    const lines = [`a village of ${pl.census.households} households: ${pl.placed.length} buildings, ${blocks.toLocaleString("en-US")} blocks one by one, ${b.calls} structure calls (${Math.round(blocks / b.calls)} blocks a call)`, `its ground: ${ground.length.toLocaleString("en-US")} columns in ${f.calls} fills; its ${sets.length} lamps, pots and barrels in ${li.calls} lists`, `its ${shown.length} people out of doors at midday: ${people.by.crowd ?? 0} crowd entities and ${people.by.walker ?? 0} walkers (${shown.length} bodies one by one); 21 entities as crowds show up to ${R.peopleFor(21)}`];
    return { ok: b.calls < pl.placed.length * 2 && people.calls <= shown.length, lines };
  },
  pantheon() {
    // the nine and their web (core/pantheon.js), held to the law they are read from: one still point and one cycle,
    // the cycle the clock's breath, opposites half a breath apart summing to the still point, every tick one god in F's
    // order, reactions settling within a breath, claims resolved the same in any order, the wake's codec exact
    const neg = ([a, b]) => [-a || 0, -b || 0], eqv = (u, v) => u[0] === v[0] && u[1] === v[1], lines = [], bad = [];
    const all = []; for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) all.push([a, b]);   // given: the three trits
    // the orbits: (0,0) still; every other pair on the one cycle, in it once
    const fixed = all.filter((v) => eqv(PAN.Fv(v), v)), onCycle = all.filter((v) => PAN.ORBIT.some((o) => eqv(o, v)));
    if (fixed.length !== 1 || !eqv(fixed[0], [0, 0])) bad.push(`F holds ${fixed.length} pairs still`);
    if (onCycle.length !== all.length - 1 || PAN.ORBIT.length !== all.length - 1) bad.push(`the cycle holds ${PAN.ORBIT.length} of the ${all.length - 1} moving pairs`);
    if (PAN.BREATH !== RUNGS.breath) bad.push(`the cycle (${PAN.BREATH}) is not the clock's breath (${RUNGS.breath})`);
    if (BAR % PAN.BREATH) bad.push(`the breath does not divide the bar (${BAR})`);
    for (const v of all) { let w = v; for (let k = 0; k < PAN.BREATH / 2; k++) w = PAN.Fv(w); if (!eqv(w, neg(v))) bad.push(`F^4 ${v} is ${w}, not -v`); if (!eqv(PAN.Finv(PAN.Fv(v)), v)) bad.push(`F^-1 F ${v} is not ${v}`); }
    // the gods: typed by b, opposites -v and half a breath on, the eight summing to the still point
    let sa = 0, sb = 0;
    for (const g of PAN.GODS.slice(0, PAN.BREATH)) { sa += g.v[0]; sb += g.v[1]; const o = PAN.opposite(g);
      if (!eqv(o.v, neg(g.v)) || (o.slot - g.slot + PAN.BREATH) % PAN.BREATH !== PAN.BREATH / 2) bad.push(`${g.title}'s opposite is ${o.title}`);
      if ((g.v[1] === 0) !== (g.op === "shear")) bad.push(`${g.title} ${g.op}s but b is ${g.v[1]}`);
      if (!eqv(PAN.next(g).v, PAN.Fv(g.v))) bad.push(`${g.title}'s answer is not F.v`); }
    if (sa || sb) bad.push(`the eight sum to (${sa},${sb}), not the still point`);
    // the turn: three bars, one god a tick, each the one F hands to
    let turnBad = 0; for (let t = 0; t < 3 * BAR; t++) if (PAN.next(PAN.godAt(t)) !== PAN.godAt(t + 1)) turnBad++;   // vision: three bars of ticks
    if (turnBad) bad.push(`${turnBad} ticks handed to the wrong god`);
    // reactions: one breath of answers leaves phi^-8 of the act, under a twenty-first
    let net = 0; for (let k = 0; k < PAN.BREATH; k++) net += PAN.reactionBound(1, k);
    const left = Math.abs(PAN.reactionBound(1, PAN.BREATH));
    if (Math.abs(net - PAN.NET) > 1e-12 || Math.abs(left - PAN.SETTLE) > 1e-12 || !(left < 1 / FIB_[7])) bad.push(`a breath leaves ${left} of an act, nets ${net}`);   // given: float equality to a part in 10^12; derived: settles under a twenty-first
    // whole units: from 610 the answers walk Fibonacci down (Binet), and no chain strays past the bound by more than the slack
    let chainBad = 0; for (let d0 = 1; d0 <= FIBS_[14]; d0++) { let d = d0, k = 0; while (d) { if (Math.abs(d) > Math.abs(PAN.reactionBound(d0, k)) + PAN.SLACK) chainBad++; d = PAN.answerOf(d); k++; } }   // derived: every first act up to 610
    if (chainBad) bad.push(`${chainBad} whole-unit answers strayed past the bound plus the slack`);
    const walk = []; for (let d = FIBS_[14]; d; d = PAN.answerOf(d)) walk.push(Math.abs(d));
    if (walk.length !== 14 || walk.some((v, i) => v !== FIBS_[14 - i])) bad.push(`from 610 the answers walked ${walk}, not down Fibonacci`);   // derived: 610 is F(15), fourteen numbers down to 1
    // claims add as vectors: a balanced set holds; otherwise the earliest slot from a lead that turns a slot a breath
    if (!PAN.resolveClaims([{ slot: 0 }, { slot: 4 }]).held) bad.push("a god and its opposite did not hold");   // vision: the Builder and the Mover
    if (!PAN.resolveClaims([{ slot: 0 }, { slot: 2 }, { slot: 3 }]).held) bad.push("a balanced three did not hold");   // vision: (1,0)+(-1,1)+(0,-1)
    const c = [{ slot: 5 }, { slot: 2 }, { slot: 7 }];   // vision: three claims that do not balance
    const leads = new Set(); for (let b = 0; b < PAN.BREATH; b++) { leads.add(PAN.leadOf(b));
      const w = PAN.resolveClaims(c, b).winner?.slot, want = c.map((x) => x.slot).sort((p, q) => (p - b + PAN.BREATH) % PAN.BREATH - (q - b + PAN.BREATH) % PAN.BREATH)[0];
      for (const order of [c, [...c].reverse(), [c[1], c[2], c[0]]]) if (PAN.resolveClaims(order, b).winner?.slot !== w) bad.push(`breath ${b}: the verdict turned with the order`);
      if (w !== want) bad.push(`breath ${b}: ${w} won, not ${want}`); }
    if (leads.size !== PAN.BREATH) bad.push(`only ${leads.size} gods led in a full turn of breaths`);
    // bounds: a stock stays in [0, room], what does not fit is the debt, and nothing is lost between them
    const room = PAN.roomOf(FIBS_[14]); let fitBad = room !== FIBS_[15] ? 1 : 0;   // derived: 610's room is 987, F(16)
    for (let s0 = 0; s0 <= room; s0 += FIB_[7]) for (let d = -room; d <= room; d += FIB_[6]) { const { put, short } = PAN.fitWrite(s0, d, room);   // derived: a grid of stocks and writes
      if (s0 + put < 0 || s0 + put > room || put + short !== d || (short && Math.sign(short) !== Math.sign(d))) fitBad++; }
    if (fitBad) bad.push(`${fitBad} writes broke the room`);
    // chance: one stream a tick, the same draw for the same tick and purpose, spread evenly
    let mean = 0; for (let t = 0; t < BAR * PAN.BREATH; t++) mean += PAN.drawOf(t, 1) / (BAR * PAN.BREATH);   // vision: a breath of bars
    if (PAN.drawOf(FIB_[10], 2) !== PAN.drawOf(FIB_[10], 2) || Math.abs(mean - 0.5) > 1 / FIB_[9]) bad.push(`draws averaged ${mean}`);   // derived: within a fifty-fifth of a half
    // holders: only their own stock
    for (const g of PAN.GODS.slice(0, PAN.BREATH)) for (let k = 0; k < PAN.BREATH; k++) if (PAN.mayWrite(g, k) !== (g.op === "record" || k === g.slot)) bad.push(`${g.title} on stock ${k}`);
    // the wake: every god's entry round trips; the Measure and a mistyped op are refused
    const view = PAN.wakeOf(PAN.BREATH); let trip = 0;
    PAN.GODS.slice(0, PAN.BREATH).forEach((g, i) => { const e = { t: 8640000 - i, slot: g.slot, op: g.op, key: 2 ** 31 - 1 - i, d: -(2 ** 31) + i, cause: i - 1, gate: -(2 ** 15) + i };   // given: a year's ticks, Int32's and Int16's ends
      PAN.encodeEntry(view, i, e); const r = PAN.decodeEntry(view, i); if (Object.keys(e).every((k) => r[k] === e[k])) trip++; else bad.push(`${g.title}'s entry came back ${JSON.stringify(r)}`); });
    const refuses = (e) => { try { PAN.encodeEntry(view, 0, e); return false; } catch { return true; } };
    if (!refuses({ t: 0, slot: PAN.MEASURE.slot, op: "record", key: 0, d: 0 })) bad.push("the Measure wrote an entry");
    if (!refuses({ t: 0, slot: PAN.godByKey.builder.slot, op: "record", key: 0, d: 0 })) bad.push("the Builder wrote a record");
    if (PAN.ENTRY_BYTES !== PAN.FIELDS.reduce((a, [, n]) => a + n, 0)) bad.push("the entry's size is not its fields'");
    lines.push(`the nine: ${PAN.GODS.map((g) => `${g.slot === PAN.BREATH ? "close" : g.slot} ${g.title} (${g.name}) (${g.v}) ${g.op}`).join(" \u00b7 ")}`);
    lines.push(`orbits: 1 still + ${PAN.ORBIT.length} in one cycle = the breath (${RUNGS.breath}), ${BAR / PAN.BREATH} breaths a bar; F^4 = -I on all nine; the eight sum to (${sa},${sb})`);
    lines.push(`opposites: ${PAN.GODS.slice(0, PAN.BREATH / 2).map((g) => `${g.title} / ${PAN.opposite(g).title}`).join(", ")}`);
    lines.push(`reactions: psi = ${PAN.PSI.toFixed(4)}; one breath leaves ${(PAN.SETTLE * 100).toFixed(2)}% of an act and nets ${PAN.NET.toFixed(4)}`);
    lines.push(`whole units: from 610 the answers walk ${walk.join(", ")}; every act up to 610 keeps within the bound + ${PAN.SLACK.toFixed(4)}`);
    lines.push(`claims: balanced sets hold; otherwise the earliest slot from the lead, which turns through all ${leads.size} in a full turn of breaths`);
    lines.push(`wake: ${PAN.ENTRY_BYTES} bytes an entry; ${trip}/${PAN.BREATH} round trips; the Measure and a mistyped op refused; ${3 * BAR} ticks handed on in F's order`);
    return { ok: !bad.length, lines: [...lines, ...bad.map((b) => `FAIL ${b}`)] };
  },
  inherency() {
    const FREE = new Set([0, 1, 2, 0.5, 90, 180, 360]);   // given: none, one, two, a half, and the degrees of a right angle, a half turn, a turn
    const files = ["core", "world"].flatMap((d) => fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith(".js")).map((f) => path.join(d, f)));
    const found = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(root, f), "utf8");
      if (/^\/\/ inherency: (home|data)/.test(src)) continue;
      src.split("\n").forEach((line, i) => {
        if (/\/\/\s*(given|vision|derived)\b/.test(line)) return;
        const code = line.replace(/\/\/.*$/, "").replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""');
        for (const m of code.matchAll(/(?<![\w$.])(\d+\.?\d*(?:e[-+]?\d+)?)(?![\w$])/gi)) if (!FREE.has(Number(m[1]))) found.push(`${f}:${i + 1} ${m[1]}`);
      });
    }
    const ratchet = JSON.parse(fs.readFileSync(path.join(root, "tests/inherency.json"), "utf8")).free;
    return { ok: found.length <= ratchet, lines: [`${found.length} free numbers in core/ and world/ (ratchet ${ratchet}: may fall, never rise)`, ...found.map((x) => `  ${x}`)] };
  },
};

export function render(file) {
  world();
  const m = map(), P = peoples().list, s = 2, w = m.w / s, h = m.h / s, out = new Uint8Array(w * h * 3);
  const BIO = { ice: [235, 240, 245], snow: [220, 225, 235], taiga: [70, 110, 80], forest: [70, 130, 60], plains: [140, 175, 90], savanna: [175, 170, 90], desert: [220, 200, 140], jungle: [40, 120, 50], swamp: [80, 100, 70], mangrove: [90, 90, 60], beach: [225, 210, 160], peaks: [160, 160, 165], cherry: [220, 160, 180], badlands: [190, 110, 70], hills: [130, 140, 120] };   // vision: the render's colours
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = climateAt(i * s, j * s); let col;
    if (c.h <= 0) { const d = -c.h; col = c.T < -4 ? [190, 210, 225] : [20 + Math.max(0, 60 - d), 60 + Math.max(0, 90 - d), 120 + Math.max(0, 100 - d)]; }   // vision: the render's sea
    else { const k = Object.keys(BIO).find((n) => c.biome.id.includes(n)) ?? "plains"; col = BIO[k]; }
    out.set(col, (j * w + i) * 3);
  }
  const TEMPER = { raiders: [220, 30, 30], wary: [240, 150, 30], peaceful: [250, 250, 250], traders: [250, 220, 0] };   // vision: the render's peoples
  for (const p of P) { const i = Math.round(p.cx / s), j = Math.round(p.cz / s); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ii = (i + a + w) % w, jj = j + b; if (jj >= 0 && jj < h) out.set(TEMPER[p.temper], (jj * w + ii) * 3); } }
  fs.writeFileSync(file, encode(w, h, out, 3));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args[0] === "render") { render(args[1] ?? "world.png"); console.log(`wrote ${args[1] ?? "world.png"}`); }
  else {
    let fail = 0;
    for (const name of args.length ? args : Object.keys(LENSES)) {
      const r = await LENSES[name]();
      if (!r.ok) fail++;
      console.log(`${r.ok ? "ok  " : "FAIL"} ${name}`);
      for (const l of r.lines) console.log(`     ${l}`);
    }
    process.exit(fail ? 1 : 0);
  }
}
