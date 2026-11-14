import { test } from "node:test";
import assert from "node:assert/strict";
import { enc, dec } from "../tools/plans.mjs";

test("plans: a place's shapes go to JSON and come back: Maps, Sets, typed arrays, infinities; functions dropped", () => {
  const place = { spine: new Set(["1,2", "3,4"]), gardens: new Map([[0, { cells: [[1, 2]] }]]), rho: new Float32Array([1.5, 2]), far: -Infinity, at: () => 0, placed: [{ id: "hut", x: 1 }] };
  const back = dec(JSON.parse(JSON.stringify(enc(place))));
  assert.deepEqual([...back.spine], ["1,2", "3,4"]);
  assert.deepEqual(back.gardens.get(0), { cells: [[1, 2]] });
  assert.ok(back.rho instanceof Float32Array && back.rho[0] === 1.5);
  assert.equal(back.far, -Infinity);
  assert.equal(back.at, undefined);
  assert.deepEqual(back.placed, [{ id: "hut", x: 1 }]);
});

test("plans: a building's voxels are refused: a plan keeps its recipe, never its blocks", () => {
  assert.throws(() => enc({ b: { vox: new Map([["0,0,0", { id: "minecraft:stone" }]]) } }), /recipe/);
});

test("plans: lists of cells keep their order through the runs they're stored as", () => {
  const cells = [[3, 1], [3, 2], [3, 3], [0, 0], [5, -2], [4, -2], [3, -2], [3, 4], [3, 5], [9, 9]];
  const e = enc({ cells });
  assert.ok(e.cells.$cells);
  assert.deepEqual(dec(JSON.parse(JSON.stringify(e))).cells, cells);
});
