import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { GREAT_ACT_STRENGTH, homePlanet, starHazard, warmingOf } from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";

test("the god warms a whole world for a while: the climate reads it as warming, and it passes", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(20 * YEAR);
  const before = warmingOf(world),
    receipt = world.submit("act.warm", { sign: 1, years: 10 });
  world.runTo(25 * YEAR);
  assert.ok(Math.abs(warmingOf(world) - before - GREAT_ACT_STRENGTH.warm) < 0.1);
  world.runTo(35 * YEAR);
  assert.ok(Math.abs(warmingOf(world) - before) < 0.1, "it passes when the years are done");
  const e = world.events.all().find((x) => x.type === "act.warm")!;
  assert.equal(e.causes[0]!.ref, receipt.id);
  // Only real acts are taken: a century at most.
  assert.throws(() => world.submit("act.warm", { sign: 1, years: 500 }));
});

test("the god makes a star flare: every land under its light finds death likelier while it lasts", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(10 * YEAR);
  const star = homePlanet(world).generated.star.ref as Ref;
  assert.equal(starHazard(world, star).factor, 1);
  world.submit("act.flare", { star, sign: -1, years: 3 });
  world.runTo(11 * YEAR);
  assert.equal(starHazard(world, star).factor, GREAT_ACT_STRENGTH.flare);
  assert.ok(starHazard(world, star).act);
  world.runTo(15 * YEAR);
  assert.equal(starHazard(world, star).factor, 1);
  assert.throws(() => world.submit("act.flare", { star: "star:9999:9", sign: -1, years: 1 }));
  void why;
});
