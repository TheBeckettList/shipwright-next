// The 2-block observer: a player 1.8 tall and 0.6 wide, walking a block world by the rules a
// Minecraft player does. Nodes are places a player can stand (feet height over a cell); edges are
// a walk (up to a slab's step, or up a stair), a jump (up to 1.25), a drop (up to 3), or a climb
// (a ladder). Everything is pure: give it a get(x, y, z) -> { id, states } and a box to search.

import { shape } from "./blocks.mjs";

const TALL = 1.8, STEP = 0.6, JUMP = 1.25, DROP = 3;

/** Every place a player can stand in the box: { x, z, feet, free } (free: headroom, capped at TALL). */
export function standable(get, box) {
  const nodes = new Map();
  for (let x = box.x0; x <= box.x1; x++) for (let z = box.z0; z <= box.z1; z++) {
    for (let y = box.y0; y <= box.y1; y++) {
      const s = shape(get(x, y, z)?.id, get(x, y, z)?.states);
      if (s.kind !== "solid" && s.kind !== "stairs") continue;
      const feet = y + s.hi;
      const free = headroom(get, x, z, feet);
      if (free < 1) continue;                          // not even crawl space
      nodes.set(key(x, z, feet), { x, z, feet, free, on: get(x, y, z)?.id, stairs: s.kind === "stairs" });
    }
    // Ladders: every ladder cell is a place on the climb.
    for (let y = box.y0; y <= box.y1; y++) {
      if (shape(get(x, y, z)?.id).kind === "ladder") nodes.set(key(x, z, y), { x, z, feet: y, free: headroom(get, x, z, y), ladder: true });
    }
  }
  return nodes;
}
const key = (x, z, f) => `${x},${z},${Math.round(f * 16)}`;

/** Clear space above feet at a column, up to TALL (an obstruction's bottom stops it). */
export function headroom(get, x, z, feet) {
  for (let y = Math.floor(feet); y <= Math.floor(feet + TALL); y++) {
    const b = get(x, y, z);
    const s = shape(b?.id, b?.states);
    if (s.kind === "pass" || s.kind === "ladder" || s.kind === "liquid") continue;
    const lo = y + s.lo, hi = y + s.hi;
    if (hi <= feet + 1e-6) continue;                    // below the feet (the block stood on)
    if (lo >= feet + TALL - 1e-6) break;
    return Math.max(0, lo - feet);
  }
  return TALL;
}

/** Breadth-first walk from the start nodes. Returns { reached: Map(key -> {node, via}), jumps }. */
export function walk(nodes, starts) {
  const byCol = new Map();
  for (const n of nodes.values()) {
    const c = `${n.x},${n.z}`;
    (byCol.get(c) ?? byCol.set(c, []).get(c)).push(n);
  }
  const reached = new Map();
  const q = [];
  for (const s of starts) { const k = key(s.x, s.z, s.feet); if (nodes.has(k)) { reached.set(k, { n: nodes.get(k), via: "start" }); q.push(nodes.get(k)); } }
  let jumps = 0;
  while (q.length) {
    const n = q.shift();
    const tall = n.free >= TALL - 1e-6;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) {
      for (const m of byCol.get(`${n.x + dx},${n.z + dz}`) ?? []) {
        const k = key(m.x, m.z, m.feet);
        if (reached.has(k) || m === n) continue;
        const up = m.feet - n.feet;
        let via = null;
        if (dx === 0 && dz === 0) {
          if ((n.ladder || m.ladder) && Math.abs(up) <= 1.01) via = "climb";
        } else if (m.free < TALL - 1e-6 || !tall) {
          if (Math.abs(up) <= STEP) via = "crawl";
        } else if (Math.abs(up) <= STEP) via = "walk";
        else if (up > 0 && up <= 1.01 && (m.stairs || n.stairs)) via = "walk";
        else if (up > 0 && up <= JUMP) via = "jump";
        else if (up < 0 && -up <= DROP) via = "drop";
        else if ((n.ladder || m.ladder) && Math.abs(up) <= 1.01) via = "climb";
        if (!via) continue;
        if (via === "jump") jumps++;
        reached.set(k, { n: m, via, from: n });
        q.push(m);
      }
    }
  }
  return { reached, jumps };
}
