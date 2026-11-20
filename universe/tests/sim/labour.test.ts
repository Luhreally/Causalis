// Who works at what (round "peoples", sim/population/systems.ts): the hands a land's fields need, the rest freed to the crafts
// and to trade; and a stream of people leaving a land is told once, when it sets out.
import { test } from "node:test";
import assert from "node:assert/strict";
import { OCC } from "../../src/rules/index.ts";
import { Province, occupationTargets } from "../../src/sim/index.ts";

const sowing = () => {
  const p = new Province(1, 0, null);
  p.knowsCultivation = true;
  return p;
};
const CAP = { forage: 100, farm: 1000, pasture: 0, areaKm2: 100 };

test("all the old share farms where the fields need them all; where they need half, the rest go to the crafts and trade", () => {
  const all = occupationTargets(sowing(), CAP, 3, null, 1),
    half = occupationTargets(sowing(), CAP, 3, null, 0.5);
  assert.ok(Math.abs(all[OCC.farmer]! - 0.77) < 1e-9);
  assert.ok(Math.abs(half[OCC.farmer]! - 0.385) < 1e-9);
  const sum = (t: number[]) => t.reduce((s, x) => s + x, 0);
  assert.ok(Math.abs(sum(all) - sum(half)) < 1e-9, "the hands are all at some work");
  assert.ok(half[OCC.crafter]! > all[OCC.crafter]! && half[OCC.trader]! > all[OCC.trader]!);
  // (With one village, no trade: the freed go to the crafts.)
  const lone = occupationTargets(sowing(), CAP, 1, null, 0.5);
  assert.equal(lone[OCC.trader], 0);
  // (And the gatherers as the fields: half of the old tenth, gone to the crafts with the field hands.)
  assert.ok(Math.abs(half[OCC.forager]! - 0.05) < 1e-9 && Math.abs(all[OCC.forager]! - 0.1) < 1e-9);
  assert.ok(Math.abs(lone[OCC.crafter]! - (0.06 + 0.385 + 0.05)) < 1e-9);
});

test("a stream of people going on is saved and loaded with its land", () => {
  const p = sowing();
  p.going = [
    { to: 7, event: "ev:0:1" as never, decision: "dec:0:1" as never, year: 40, count: 120 },
  ];
  const back = Province.load(p.save());
  assert.deepEqual(back.going, p.going);
  // (A land saved before streams were told once has none.)
  const { going: _, ...old } = p.save() as Record<string, unknown>;
  assert.deepEqual(Province.load(old).going, []);
});

test("where no ground can be tilled none are at fields: those the wild cannot use keep its herds, and the rest go to the crafts", () => {
  const NONE = { forage: 100, farm: 0, pasture: 5000, areaKm2: 100 },
    use = { tilled: 0, gathered: 0.25, herded: 0.3 },
    herding = sowing();
  herding.herding = "ev:0:1" as never;
  const t = occupationTargets(herding, NONE, 3, null, 1, use),
    sum = (x: number[]) => x.reduce((s, v) => s + v, 0);
  // (Until 2026-11-20 they stayed "farmers" on fields the land did not have: a third of tide 207's land 3659 grew nothing.)
  assert.equal(t[OCC.farmer], 0);
  assert.ok(Math.abs(t[OCC.herder]! - 0.3) < 1e-9, `herders ${t[OCC.herder]}`);
  assert.ok(Math.abs(t[OCC.forager]! - 0.25) < 1e-9);
  assert.ok(Math.abs(sum(t) - 1) < 1e-9, "every hand at some work");
  // (No herds kept: all to the crafts and to trade.)
  const none = occupationTargets(sowing(), NONE, 3, null, 1, use);
  assert.equal(none[OCC.farmer], 0);
  assert.equal(none[OCC.herder], 0);
  assert.ok(Math.abs(sum(none) - 1) < 1e-9);
  // (A land with any field is as it was.)
  const some = occupationTargets(herding, { ...NONE, farm: 10 }, 3, null, 1, {
    ...use,
    tilled: 0.2,
  });
  assert.ok(Math.abs(some[OCC.farmer]! - 0.55) < 1e-9, `farmers ${some[OCC.farmer]}`);
});
