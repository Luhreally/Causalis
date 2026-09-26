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

test("coal lies where swamp forests were buried, in the wet tropics of their age; oil where warm seas were", () => {
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
      const then = pastLatitude(w.grid, w.tectonics, d.cell, (a.from + a.to) / 2);
      assert.ok(Math.abs(then) < (25 * Math.PI) / 180, "it lay in the tropics then");
    }
    for (const d of oil) {
      assert.ok(w.deep.oil[d.cell]! > 0);
      assert.equal(d.detail.age, w.deep.oilAge[d.cell]);
    }
  }
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
