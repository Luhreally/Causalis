import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText, type Ref } from "../../src/kernel/index.ts";
import {
  AGES,
  ageRef,
  generateHomeWorld,
  pastLatitude,
  pastPosition,
} from "../../src/gen/index.ts";
import { EARTHLIKE } from "../../src/rules/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { why } from "../../src/causal/index.ts";
import { homePlanet } from "../../src/sim/index.ts";

const worlds = ["first light", "kestrel", "amber"].map((s) =>
  generateHomeWorld(seedFromText(s), EARTHLIKE),
);

test("the ages run from the oldest to now, and differ from world to world", () => {
  for (const w of worlds) {
    assert.equal(w.deep.ages.length, AGES);
    w.deep.ages.forEach((a, k) => {
      assert.equal(a.index, k);
      assert.equal(a.from - a.to, 25);
      assert.equal(a.forests, k >= 1, "land plants arise after the first age");
    });
    assert.equal(w.deep.ages.at(-1)!.to, 0, "the last age runs to now");
  }
  const warmths = worlds.map((w) => w.deep.ages.map((a) => a.warmth).join(","));
  assert.equal(new Set(warmths).size, worlds.length);
});

test("a land's past place follows its plate's turning: now it is where it is, back then elsewhere", () => {
  const w = worlds[0]!;
  let moved = 0;
  for (let c = 0; c < w.grid.count; c += 997) {
    const [x, y, z] = pastPosition(w.grid, w.tectonics, c, 0);
    assert.ok(Math.abs(x - w.grid.positions[3 * c]!) < 1e-12);
    assert.ok(Math.abs(y - w.grid.positions[3 * c + 1]!) < 1e-12);
    assert.ok(Math.abs(z - w.grid.positions[3 * c + 2]!) < 1e-12);
    const p = pastPosition(w.grid, w.tectonics, c, 300);
    assert.ok(Math.abs(Math.hypot(...p) - 1) < 1e-9, "still on the sphere");
    if (Math.abs(pastLatitude(w.grid, w.tectonics, c, 300) - w.grid.lat[c]!) > 0.1) moved++;
  }
  assert.ok(moved > 5, `${moved} lands lay far from where they are now`);
});

// (Since the breadth round a seam is what waterlogged ground kept of its growth, its rain far past what its warmth drew off:
// gen/deeptime.ts buryCarbon. Rain falls in two belts, under the tropics' rising air and under the storm tracks about fifty
// degrees; so a seam is a warm swamp's or a cold bog's, and none was laid in the dry belts between or toward the poles.)
test("coal lies where waterlogged ground was buried, under the tropics' rain or the storm tracks' of its age, never the dry belts; oil where warm seas were", () => {
  let swamps = 0,
    bogs = 0;
  for (const w of worlds) {
    const coal = w.deposits.filter((d) => d.kind === "coal"),
      oil = w.deposits.filter((d) => d.kind === "oil");
    assert.ok(coal.length >= 5 && oil.length >= 5, `${coal.length} coal, ${oil.length} oil`);
    for (const d of coal) {
      assert.ok(w.deep.coal[d.cell]! > 0);
      assert.ok(w.tectonics.elevation[d.cell]! > 0, "under land now");
      const age = d.detail.age as number,
        a = w.deep.ages[age]!;
      assert.equal(age, w.deep.coalAge[d.cell]);
      assert.ok(a.forests);
      const then =
        (Math.abs(pastLatitude(w.grid, w.tectonics, d.cell, (a.from + a.to) / 2)) * 180) / Math.PI;
      if (then < 20) swamps++;
      else if (Math.abs(then - 50) < 12) bogs++;
      else assert.fail(`a seam laid at ${then.toFixed(0)}°, under neither rain belt of its age`);
    }
    for (const d of oil) {
      assert.ok(w.deep.oil[d.cell]! > 0);
      assert.equal(d.detail.age, w.deep.oilAge[d.cell]);
    }
  }
  assert.ok(swamps >= 10 && bogs >= 5, `${swamps} seams of warm swamps, ${bogs} of cold bogs`);
});

test("a coal seam explains itself back to the age that laid it, the world and its star", () => {
  const world = EARTH.build(seedFromText("first light")),
    d = homePlanet(world).generated.deposits.find((x) => x.kind === "coal")!;
  const seam = why(world, d.ref as Ref);
  assert.match(
    seam.claim,
    /laid down by buried swamp forests in the \w+ age, \d+–\d+ million years ago, when this land lay at/,
  );
  assert.equal(seam.causes[0]!.cause.ref, ageRef(0, d.detail.age as number));
  const age = seam.causes[0]!.next();
  assert.match(age.claim, /of the world's 16 ages/);
  assert.match(age.causes[0]!.next().claim, /^A world of/);
});
