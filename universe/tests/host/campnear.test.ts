import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY, YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { populationContext } from "../../src/sim/index.ts";
import {
  BAND_DAY,
  MEADOW_STEP,
  bandHour,
  bandQuarry,
  newBand,
  newMeadow,
  stepBand,
  stepMeadow,
} from "../../src/view/index.ts";
import type { CampNear, LandPlan } from "../../src/bridge/index.ts";

// Phase 29 M160: a camp of a land's bands seen near — one of its bands living its day among the
// land's own beasts, at the world's hour. The Earth seed in its first year.

const world = EARTH.build(seedFromText("first light"));
world.runTo(YEAR / 8 + DAY / 3);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T,
  ctx = populationContext(world),
  cell = [...ctx.provinces.all()].sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0]!.cell,
  camps = ask<LandPlan>("towns.land", { cell }).camps;

test("a camp seen near: the land's own beasts, a band of the camp's, the world's hour", () => {
  const near = ask<CampNear>("camp.near", { cell, id: camps[0]!.id });
  assert.equal(near.cell, cell);
  assert.deepEqual(near.camp, camps[0]);
  assert.ok(near.size >= 6 && near.size <= 24, `a band of ${near.size}`);
  assert.ok(near.figure, "the people's figure");
  assert.ok(Math.abs(near.hour - ((world.now % DAY) / DAY) * 24) < 1e-9, "the world's hour");
  assert.equal(near.plan.ages.length, 1);
  assert.ok(near.plan.lineages.length >= 3, `${near.plan.lineages.length} lineages`);
  for (const l of near.plan.lineages) {
    assert.ok(l.body, `${l.name} has a body`);
    assert.equal(l.arose, 0);
    assert.equal(l.died, null);
  }
  // (Foragers keep no flock.)
  assert.deepEqual(near.flocks, []);
  assert.deepEqual(
    ask<CampNear>("camp.near", { cell, id: camps[0]!.id }),
    near,
    "the same asked again",
  );
  assert.equal(ask<CampNear | null>("camp.near", { cell, id: 99 }), null, "no such camp");
});

test("the band lives a day among them, from the world's hour, hunting the land's beasts", () => {
  const near = ask<CampNear>("camp.near", { cell, id: camps[0]!.id }),
    m = newMeadow(near.plan, 0, near.plan.seed, true),
    names = new Set(near.plan.lineages.map((l) => l.name));
  assert.ok(m.kinds.length >= 2 && m.kinds.every((k) => names.has(k.name)), "the land's own kinds");
  assert.ok(m.shrubs.length > 0 && m.grass.some((g) => g > 0.5), "green and wooded, a land of now");
  const b = newBand(m, near.size, near.people, near.plan.seed, near.hour);
  assert.equal(b.people.length, near.size);
  assert.ok(Math.abs(bandHour(b) - near.hour) < 1e-9, "begun at the world's hour");
  for (let i = 0; i < (2 * BAND_DAY) / MEADOW_STEP; i++) {
    stepMeadow(m);
    stepBand(b, m);
  }
  assert.ok(b.day >= 1, "a day gone");
  assert.ok(b.gathered + b.hunts > 0, "they went out to gather or hunt");
});

test("a herding band's hunters leave its own flock be", () => {
  const near = ask<CampNear>("camp.near", { cell, id: camps[0]!.id }),
    m = newMeadow(near.plan, 0, near.plan.seed, true),
    k = m.kinds.findIndex((x) => x.feed === "graze" || x.feed === "browse"),
    beast = m.beasts.find((x) => x.kind === k)!;
  assert.ok(beast, "a beast that eats grass or leaf");
  const before = bandQuarry(m, beast);
  m.kinds[k]!.tame = true;
  assert.equal(bandQuarry(m, beast), false, "spared");
  assert.ok(before || m.kinds[k]!.size < 8 || m.kinds[k]!.size > 1200, "wild, it was quarry");
});
