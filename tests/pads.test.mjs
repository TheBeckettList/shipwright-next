import { test } from "node:test";
import assert from "node:assert/strict";
import { loadMap } from "../world/load.js";
import * as G from "../game/ground.js";
import { BANK } from "../world/terraform.js";

loadMap();
// a land chunk on a slope, away from Thera: the first found on a coarse grid
function landChunk() {
  for (let cz = 500; cz < 6000; cz += 250) for (let cx = 500; cx < 9000; cx += 250) { const x = cx * 16 + 8, z = cz * 16 + 8, h = G.naturalAt(x, z).h; if (h > 10 && Math.abs(G.naturalAt(x + 4, z).h - h) > 0.6) return [cx, cz]; }
  throw new Error("no land chunk");
}

test("pads: with none, the ground is the natural ground, column for column", () => {
  G.usePads(null, null);
  const [cx, cz] = landChunk();
  for (let i = 0; i < 16; i += 3) { const x = cx * 16 + i, z = cz * 16 + i; assert.equal(G.heightAt(x, z).h, G.naturalAt(x, z).h); }
});

test("pads: the box stands at L, the banks ease to nature by the reach, and a chunk's columns agree with heightAt", () => {
  const [cx, cz] = landChunk(), x0 = cx * 16 + 5, z0 = cz * 16 + 5, x1 = x0 + 5, z1 = z0 + 5;
  const L = Math.round(G.naturalAt(x0, z0).h);
  const pads = Int32Array.from([x0, z0, x1, z1, L, 0, 0, 0]), by = {};
  for (let a = Math.floor((x0 - BANK.REACH) / 16); a <= Math.floor((x1 + BANK.REACH) / 16); a++) for (let b = Math.floor((z0 - BANK.REACH) / 16); b <= Math.floor((z1 + BANK.REACH) / 16); b++) by[`${a},${b}`] = [0];
  G.usePads(pads, by);
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) assert.equal(Math.round(G.heightAt(x, z).h), L, `on the box at ${x},${z}`);
  const far = x1 + BANK.REACH + 1; assert.equal(Math.round(G.heightAt(far, z0).h), Math.round(G.naturalAt(far, z0).h), "past the reach");
  const plan = G.chunkColumns(cx, cz);
  for (const c of plan.cols) assert.equal(c.top, G.SEA + Math.round(G.heightAt(c.x, c.z).h), `column ${c.x},${c.z}`);
  G.usePads(null, null);
});
