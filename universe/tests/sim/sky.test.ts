import { test } from "node:test";
import assert from "node:assert/strict";
import { PRINCIPLES, affordsPrinciple, needsMet, type Medium } from "../../src/rules/index.ts";

/** Everything a body could ever come to know, the tree followed from its roots. */
function reachable(medium: Medium, fire: boolean): Set<string> {
  const known = new Set<string>(["cultivation", "herding", "metalworking"]);
  for (let grew = true; grew;) {
    grew = false;
    for (const p of PRINCIPLES)
      if (
        !known.has(p.id) &&
        affordsPrinciple(p, medium, fire) &&
        needsMet(p, (n) => known.has(n))
      ) {
        known.add(p.id);
        grew = true;
      }
  }
  return known;
}

const SKY = [
  "electronics",
  "rocketry",
  "guidance",
  "orbital-flight",
  "life-support",
  "stations",
  "transfer-flight",
  "habitats",
  "nuclear-drive",
];

test("the sky is reached by the land's road and by the sea's", () => {
  const land = reachable("land", true),
    sea = reachable("water", false);
  for (const id of SKY) {
    assert.ok(land.has(id), `a people of the land with fire reaches ${id}`);
    assert.ok(sea.has(id), `a people of the water without fire reaches ${id}`);
  }
  // By different roads: the land through its electricity, the sea through its own.
  assert.ok(land.has("electricity") && !land.has("sea-electricity"));
  assert.ok(sea.has("sea-electricity") && !sea.has("electricity"));
});

test("a need written a|b is met by either", () => {
  const p = { needs: ["a|b", "c"] };
  assert.ok(needsMet(p, (n) => n === "b" || n === "c"));
  assert.ok(needsMet(p, (n) => n === "a" || n === "c"));
  assert.ok(!needsMet(p, (n) => n === "a" || n === "b"));
});
