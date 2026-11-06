// The greatest fire's numbers (War past the line, W5): pure, on anchors anyone can state. What history does with them is gate 81's.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  FIRE,
  chanceOfFall,
  fearOf,
  fieldsUnder,
  fireLots,
  greatFallOf,
  holdBackBy,
  rainUnder,
  shadowOf,
  unmakeMj,
} from "../src/rules/index.ts";

test("one flattens a great city's heart, and a small town is lost", () => {
  const city = greatFallOf({ lots: 100_000, people: 2e6, miss: 100 }),
    town = greatFallOf({ lots: 300, people: 9000, miss: 100 });
  assert.ok(fireLots() > 1000);
  assert.ok(city.share > 0.1 && city.share < 0.5);
  assert.ok(city.dead > 100_000);
  assert.equal(town.share, FIRE.mostGone);
});

test("holding back is what the numbers usually say", () => {
  const worst = chanceOfFall({ desperation: 1, valour: 1, fear: 0, dread: 0 });
  assert.ok(worst <= FIRE.mostChance);
  assert.ok(worst < 0.5);
  const answered = chanceOfFall({ desperation: 1, valour: 1, fear: fearOf(0.01), dread: 0 });
  assert.ok(answered < worst / 10, "a strike back holds a ruler back");
  const dreaded = chanceOfFall({ desperation: 1, valour: 1, fear: 0, dread: FIRE.dreadFirst });
  assert.ok(dreaded < worst / 3, "a first fall changes every ruler's mind");
});

test("no answer to fear holds no war back, by exactly nothing", () => {
  assert.equal(fearOf(0), 0);
  assert.equal(holdBackBy(fearOf(0)), 1);
  assert.ok(holdBackBy(fearOf(0.01)) < 0.05);
});

test("a clear sky takes exactly nothing from rain or fields", () => {
  assert.equal(rainUnder(0), 1);
  assert.equal(fieldsUnder(0), 1);
  assert.ok(rainUnder(0.5) < 1 && fieldsUnder(0.5) < rainUnder(0.5));
});

test("the shadow is a reading: none where no one holds it, near in a crisis", () => {
  const quiet = { holders: 0, atOdds: 3, wars: 3, worst: 1, crises: 1, dread: 0 };
  assert.equal(shadowOf(quiet), 0);
  const calm = shadowOf({ holders: 2, atOdds: 0, wars: 0, worst: 0, crises: 0, dread: 0 }),
    brink = shadowOf({ holders: 2, atOdds: 1, wars: 1, worst: 0.8, crises: 1, dread: 0 });
  assert.ok(calm < 45);
  assert.ok(brink > 60);
});

test("it is not the top of any ladder: a world's binding energy lies far past it", () => {
  const earth = unmakeMj({ pull: 1, radius: 1 });
  assert.ok(earth > 1e26 && earth < 4e26);
  assert.ok(earth / (FIRE.mostLoads * FIRE.mj) > 1e15);
});
