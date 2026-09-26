import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRINCIPLES,
  STAR_DRIVES,
  affordsPrinciple,
  crossingYears,
  cruise,
  longestCrossing,
  needsMet,
  starDriveFor,
} from "../../src/rules/index.ts";

const drive = (id: string) => STAR_DRIVES.find((d) => d.id === id)!;

test("between the stars: fusion a twentieth of light's speed, sails a tenth, antimatter near a third", () => {
  assert.ok(cruise(drive("fusion")) > 0.03 && cruise(drive("fusion")) < 0.06);
  assert.ok(cruise(drive("sail")) > cruise(drive("fusion")));
  assert.ok(
    cruise(drive("antimatter")) <= 0.3 && cruise(drive("antimatter")) > cruise(drive("sail")),
  );
  // A crossing of twelve light-years: centuries on fusion, decades on antimatter.
  assert.ok(crossingYears(12, drive("fusion")) > 200);
  assert.ok(crossingYears(12, drive("antimatter")) < 60);
  // Nothing faster than light.
  for (const d of STAR_DRIVES) assert.ok(cruise(d) < 1);
});

test("a people takes the fastest drive it knows, and sends its own no farther than they can live to arrive", () => {
  const knows =
    (...ids: string[]) =>
    (id: string) =>
      ids.includes(id);
  assert.equal(starDriveFor(knows("nuclear-drive")), null);
  assert.equal(starDriveFor(knows("fusion-drive"))!.id, "fusion");
  assert.equal(starDriveFor(knows("fusion-drive", "antimatter-drive"))!.id, "antimatter");
  assert.ok(longestCrossing(knows("long-sleep")) > longestCrossing(knows()));
});

test("the drives between the stars are within reach of the land's road and the sea's", () => {
  for (const [medium, fire] of [
    ["land", true],
    ["water", false],
  ] as const) {
    const known = new Set(["cultivation", "herding", "metalworking"]);
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
    for (const id of ["fusion-drive", "long-sleep", "beamed-sails", "antimatter-drive"])
      assert.ok(known.has(id), `${medium}: ${id}`);
  }
});
