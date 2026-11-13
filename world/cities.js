// Pure (given a loaded map). Each people's town grown on its own ground: its census from its real size, living and
// temper (boxes.js populations, peoples.js), its ground the game's own (game/ground.js heightAt: the map's, Thera's island where it reaches; the sea at zero), its
// epicentre where its people would put it: a port's at the shore of its lee (economy.js siteOf, the land block
// nearest the water: the seafront is a port's peak), a farming or herding town's at the flattest land near its heart.
// The rest is district.js: the rings bent round the sea and the hills, the press, the shape and its spines.
import { FIB, FIBS, PHI } from "../core/golden.js";
import { GIVEN, D } from "../core/given.js";
import { peoples } from "./peoples.js";
import { populations } from "./boxes.js";
import { siteOf } from "./economy.js";
import { societyOf } from "./society.js";
import { placeOf } from "./district.js";
import { settlements } from "./settlements.js";
import { seaOf } from "./shipping.js";
import { climateAt } from "./climate.js";
import { heightAt } from "../game/ground.js";

const C = D.PX;   // blocks a map cell
/** Where a people's town centres, in blocks: the land block nearest the water in its site's chunk (a port), or its heart's flattest. */
export function epicentreOf(p) {
  const blockHeight = (x, z) => heightAt(x, z).h;   // the game's ground
  const site = siteOf(p), W = D.CELLS_W, cx = site != null ? site % W : Math.round(p.cx), cz = site != null ? Math.floor(site / W) : Math.round(p.cz), port = p.living === "fishers" || p.temper === "traders";
  let best = null;
  const score = (x, z) => {
    const h = blockHeight(x, z); if (h <= 0) return Infinity;
    let wet = Infinity; if (port) for (let r = 1; r <= FIB[5] && wet === Infinity; r++) for (const [a, b] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (blockHeight(x + a, z + b) <= 0) wet = r;   // derived: the water within eight
    const slope = Math.abs(blockHeight(x + 1, z) - blockHeight(x - 1, z)) + Math.abs(blockHeight(x, z + 1) - blockHeight(x, z - 1));
    return (port ? (wet === Infinity ? FIB[6] : Math.abs(wet - FIB[3])) : Math.hypot(x - (cx * C + C / 2), z - (cz * C + C / 2)) / C) + slope * FIB[3];   // derived: three blocks back from the water's edge; a block of slope costs three
  };
  const S = FIB[5], cands = [];   // derived: the site's cell and its ring looked at every eight blocks
  for (let x = cx * C - C; x < cx * C + 2 * C; x += S) for (let z = cz * C - C; z < cz * C + 2 * C; z += S) { const s = score(x, z); if (s < Infinity) cands.push({ x, z, score: s }); }
  // the site: of the thirteen best spots, the highest of the site score (the extremum the ground offers this people):
  // ease (the ground flat round the core) to the phi, shelter (a bay: bearings meeting land) for a port, water near,
  // the land's yield, and for a wary people the ground's prominence
  cands.sort((a, b) => a.score - b.score);
  const wary = p.temper === "wary", RAYS = FIB[6], DIRS = FIB[5];   // derived: thirteen bearings; eight round a spot
  const siteScore = (x, z) => {
    const h = blockHeight(x, z); let slope = 0, ring = 0, wetNear = 0;
    for (let k = 0; k < DIRS; k++) { const a = (2 * Math.PI * k) / DIRS, ca = Math.cos(a), sa = Math.sin(a);
      for (const r of [FIB[6], FIB[8]]) slope += Math.abs(blockHeight(x + ca * r, z + sa * r) - h) / r / (2 * DIRS);   // derived: the site score's measures (see above)
      ring += blockHeight(x + ca * FIB[10], z + sa * FIB[10]) / DIRS;   // derived: the site score's measures (see above)
      const g = heightAt(Math.round(x + ca * FIB[6]), Math.round(z + sa * FIB[6])); if (g.h <= 0 || g.water != null) wetNear = 1; }   // derived: the ground's slope over 13 and 34 blocks; its ring at 89; water within 13
    let shelter = 0; if (port) for (let k = 0; k < RAYS; k++) { const a = (2 * Math.PI * k) / RAYS; for (let r = FIB[7]; r <= FIBS[12]; r += FIB[7]) if (blockHeight(x + Math.cos(a) * r, z + Math.sin(a) * r) > 0) { shelter += 1 / RAYS; break; } }   // derived: a bearing sheltered if land stands within 233 blocks (looked at every 21)
    const cl = climateAt(Math.floor(x / C), Math.floor(z / C)), y = ((cl.biome?.yield?.crop ?? 0) + (cl.biome?.yield?.herd ?? 0)) / 2, prom = Math.max(0, Math.min(1, (h - ring) / FIB[8]));   // derived: the site score's measures (see above)
    return Math.exp(-slope * FIB[3]) ** PHI * (port ? 1 + shelter : 1) * (1 + wetNear) * (1 / PHI + y) * (wary ? 1 + prom : 1);   // derived: a block of rise in three costs a share e; a yield-less land still a golden share worth
  };
  let top = null; for (const c of cands.slice(0, FIB[6])) { const v = siteScore(c.x, c.z); if (!top || v > top.v) top = { ...c, v }; }   // derived: the site score's measures (see above)
  if (top) { best = top; const b0 = top; for (let x = b0.x - S; x <= b0.x + S; x++) for (let z = b0.z - S; z <= b0.z + S; z++) { const s = score(x, z); if (s < best.score) best = { x, z, score: s }; } }
  return best ?? { x: cx * C + C / 2, z: cz * C + C / 2 };
}
// ---- the claims: every place its own ground. Each place's claim is a multiplicatively weighted Voronoi cell of the
// epicentres (a block is the place's whose distance over its reach is least: every place keeps a disc round its own
// heart, the bigger pushing the line toward the smaller), the reach a golden square of the root of its people (a
// town's radius grows as the root of its folk), and a green belt of 13 blocks between
// two claims that neither builds on. A town grows (its streets, its buildings, its farms) inside its own.
export const CLAIM = { BELT: FIB[6], REACH: FIB[10] * FIB[5] };   // vision: thirteen blocks of belt; neighbours looked for within 712 blocks
/** The claims: each settlement's heart and its reach (its whole footprint: town, buffer, country). */
export const claims = () => settlements(epicentreOf).list.map((st) => ({ key: st.key, at: st.at, w: st.rr }));
/** Is world block (x, z) another settlement's (or the belt between)? For the settlement holding place `key`. */
export function claimTest(key) {
  const S = settlements(epicentreOf), mine0 = S.byMember.get(key); if (!mine0) return () => false;
  const all = claims(), me = all.find((c) => c.key === mine0.key);
  const near = all.filter((c) => c.key !== me.key && Math.hypot(c.at.x - me.at.x, c.at.z - me.at.z) < CLAIM.REACH + c.w + me.w);
  return (x, z) => { const mine = (Math.hypot(x - me.at.x, z - me.at.z) + CLAIM.BELT / 2) / me.w; for (const c of near) if ((Math.hypot(x - c.at.x, z - c.at.z) - CLAIM.BELT / 2) / c.w < mine) return true; return false; };   // half the belt each side
}
/** A people's town, grown: { p, at, place, pop, tier } with the place in the town's frame (add at.x, at.z for the world's). */
export function cityOf(p0, { seed = 0 } = {}) {
  const st = settlements(epicentreOf).byMember.get(p0.key), p = st?.lead ?? p0, soc = societyOf(p), at = st?.at ?? epicentreOf(p), pop = { ...(populations().get(p.key) ?? {}), pop: st?.folk ?? populations().get(p.key)?.pop };   // the settlement it lives in: its leader's heart, all its members' folk
  const ground = { h: (x, z) => heightAt(at.x + x, at.z + z).h }, water = (x, z) => ground.h(x, z) <= 0;   // the ground the game lays (game/ground.js: the map's own, Thera's island where it reaches)
  const theirs = claimTest(p.key), blocked = (x, z) => theirs(at.x + x, at.z + z) || water(x, z) || Math.abs(ground.h(x + 1, z) - ground.h(x - 1, z)) + Math.abs(ground.h(x, z + 1) - ground.h(x, z - 1)) > FIB[3];   // derived: steeper than a block and a half a block is cliff
  const slopeAt = (() => { const gx = ground.h(FIB[3], 0) - ground.h(-FIB[3], 0), gz = ground.h(0, FIB[3]) - ground.h(0, -FIB[3]), g = Math.hypot(gx, gz) / (2 * FIB[3]); return g > 1 / FIB[6] ? { dir: [gx / Math.hypot(gx, gz), gz / Math.hypot(gx, gz)], grade: g } : null; })();   // derived: a slope worth stepping: past a block in thirteen
  const sea = seaOf(p, { soc }), cl = climateAt(Math.floor(at.x / C), Math.floor(at.z / C)), RAD = Math.PI / 180, wind = Math.atan2(-Math.cos(cl.windFrom * RAD), Math.sin(cl.windFrom * RAD));   // its fleet's demand (shipping.js) and the weather's bearing in the town's frame (x east, z south)   // given: degrees
  const place = placeOf({ t: p.tradition, folk: pop?.pop ?? soc.folk, living: p.living, temper: soc.temper, capital: /city|hub/.test(pop?.tier ?? "") }, { seed, ground, water, blocked, slope: slopeAt, sea, wind });
  return { p, at, place, pop: pop?.pop ?? soc.folk, tier: pop?.tier, soc, ground, water, sea, settlement: st };
}
