// A world's showings of its own chemistry (Phase 54 M222): native iron where lava ran through buried
// coal on a world where nothing rusts, the hardener's ore where its rocks hold it — nickel only up an
// old ocean floor thrust onto a land — and each as often as its crust holds of it; Earth's exactly
// as they were (tests/gen/showings-pre54.test.ts holds frozen copies).
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import {
  BOUNDARY,
  generateHomeWorld,
  ironShowing,
  nativeIronLands,
  provinceWorld,
  surfaceOre,
  worldChemistry,
} from "../../src/gen/index.ts";
import { EARTHLIKE, OPEN, TELLURIC_GRADE } from "../../src/rules/index.ts";
import { oreGrade } from "../../src/sim/index.ts";

const open = (seed: string) => provinceWorld(generateHomeWorld(seedFromText(seed), OPEN));
const cells = (n: number) => Array.from({ length: n }, (_, i) => i);

test("native iron shows where lava ran through buried coal, on a world where nothing rusts", () => {
  const g = open("alien 16"),
    native = nativeIronLands(g),
    telluric = cells(g.grid.count).filter((c) => ironShowing(g, c) === "telluric");
  assert.equal(worldChemistry(g).redox, "reduced");
  assert.deepEqual(
    telluric,
    [...native].sort((a, b) => a - b),
  );
  assert.equal(telluric.length, 6);
  for (const c of telluric) assert.ok(surfaceOre(g, c, "iron"), `iron shows at ${c}`);
  // A lump of native iron yields half a bloom's iron.
  assert.equal(oreGrade("iron", "telluric", worldChemistry(g)), TELLURIC_GRADE);
});

test("Earth shows no native iron", () => {
  const g = provinceWorld(generateHomeWorld(seedFromText("first light"), EARTHLIKE));
  assert.equal(nativeIronLands(g).size, 0);
  assert.ok(cells(g.grid.count).every((c) => ironShowing(g, c) !== "telluric"));
});

test("nickel shows only up an old ocean floor thrust onto a land", () => {
  const g = open("alien 41"),
    t = g.tectonics;
  assert.equal(worldChemistry(g).hardener, "nickel");
  const shows = cells(g.grid.count).filter((c) => surfaceOre(g, c, "tin"));
  assert.ok(shows.length > 0, "some nickel shows");
  for (const c of shows) {
    assert.equal(t.boundary[c], BOUNDARY.convergent, `${c} on a collision`);
    assert.ok(t.toBoundary[c]! <= 3, `${c} near the suture`);
    const across = t.across[c]!;
    assert.ok(across >= 0 && !t.plates[across]!.continental, `${c}: an ocean plate across`);
  }
});
