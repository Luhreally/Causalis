import { test } from "node:test";
import assert from "node:assert/strict";
import { personSolids } from "../../src/ui/portrait.ts";
import { NO_LOOK, type Portrait } from "../../src/bridge/index.ts";

test("inspection equipment fits the figure's units and a sword remains visible when the other arm is lost", () => {
  const person: Extract<Portrait, { kind: "person" }> = {
    kind: "person",
    ref: "inspection-fixture",
    age: 32,
    span: 70,
    occupation: 0,
    child: false,
    era: "metal",
    body: null,
    look: { ...NO_LOOK, lost: ["arm-l"] },
    equipment: {
      guard: "plate",
      guardWords: "iron plate armor",
      arm: "sword",
      armWords: "iron sword",
      color: [0.62, 0.67, 0.72],
      year: 125,
    },
  };
  const equipped = personSolids(person),
    bare = personSolids(person, true),
    unarmed = personSolids({ ...person, equipment: { ...person.equipment!, arm: "none" } }),
    height = (solids: typeof equipped) =>
      Math.max(...solids.map((s) => s.y + s.sy / 2)) -
      Math.min(...solids.map((s) => s.y - s.sy / 2));
  assert.ok(
    height(equipped) <= height(bare) * 1.35,
    "a sword must not shrink the body out of its inspection frame",
  );
  assert.ok(equipped.length > unarmed.length, "the intact hand still carries its sword");
  const shield = personSolids({
    ...person,
    look: NO_LOOK,
    equipment: { ...person.equipment!, guard: "shield", arm: "none" },
  });
  assert.ok(height(shield) <= height(bare) * 1.35, "a shield must not be larger than its bearer");
});
