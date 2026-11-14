import { test } from "node:test";
import assert from "node:assert/strict";
import { nearestDir } from "../BP/scripts/bottles.js";
import { PLANS } from "../BP/scripts/config/plans.js";
import { readdirSync } from "node:fs";

test("bottles: she's uncorked bow the way you look, snapped to the nearest compass point", () => {
  assert.equal(nearestDir({ x: 0.1, z: 0.9 }), "south");
  assert.equal(nearestDir({ x: -0.8, z: 0.3 }), "west");
  assert.equal(nearestDir({ x: 0.7, z: -0.71 }), "north");
});

test("bottles: every plan has its bottle in the creative menu", () => {
  const items = new Set(readdirSync(new URL("../BP/items/", import.meta.url)));
  for (const id of Object.keys(PLANS)) assert.ok(items.has(`bottle_${id}.json`), `no bottle for ${id} (python3 ship/tools/gen_bottles.py)`);
});
