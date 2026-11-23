// A far people's reigns as news (sim/space/far-reigns.ts): of a people heard, the first reign known is only kept; each that
// passes after is told once, as a succession within the house or as the house's fall, as their light brings it; nothing is
// told of a people not heard. And how far a realm's hand bites on a group it outlawed by name (sim/order/grouphand.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  seedFromText,
  yearOfMoment,
  type Ref,
  type SimTime,
} from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  FAR_REIGN_EVENTS,
  civilizationsNear,
  contactsOf,
  farHouseOf,
  farReignsOf,
  farRulerOf,
  namedBite,
  type PopulationContext,
} from "../../src/sim/index.ts";
import { farReignsYear } from "../../src/sim/space/far-reigns.ts";
import { why } from "../../src/causal/index.ts";

test("a far people's seat passing is told once a reign, as a succession or a fall, only of a people heard", () => {
  const world = EARTH.build(seedFromText("first light")),
    civs = civilizationsNear(world).filter((c) => Number.isFinite(c.offset));
  assert.ok(civs.length >= 2, `${civs.length} peoples`);
  const heard = civs[0]!,
    unheard = civs[1]!,
    ctx = { world } as unknown as PopulationContext,
    told: { reign: number; fell: boolean; ref: Ref }[] = [];
  contactsOf(world).add({ civ: heard.ref, heard: heard.ref, by: "pol:0:1" as Ref, year: 0 });
  const from = Math.ceil(heard.offset) + Math.ceil(heard.distance) + 10;
  for (let y = from; y < from + 400; y++) {
    const before = world.events.count;
    farReignsYear(ctx, (y * YEAR) as SimTime);
    for (let i = before; i < world.events.count; i++) {
      const e = world.events.at(i);
      if (e.type !== FAR_REIGN_EVENTS.reign.type) continue;
      assert.deepEqual(e.subjects, [heard.ref], "told only of the people heard");
      const seen = yearOfMoment((y * YEAR) as SimTime) - Math.ceil(heard.distance),
        r = farRulerOf(world, heard, seen)!,
        d = e.data as { ruler: string; house: string; fell?: string; then: number };
      assert.equal(d.ruler, r.name);
      assert.equal(d.house, farHouseOf(world, heard, seen)!.name);
      assert.equal(d.then, seen, "as their light brings it");
      assert.match(
        why(world, e.id).claim,
        d.fell ? /fell from the seat/ : /passed within the house/,
      );
      told.push({ reign: r.reign, fell: !!d.fell, ref: e.id });
    }
  }
  assert.ok(told.length >= 3, `${told.length} reigns told in 400 years`);
  for (let i = 1; i < told.length; i++)
    assert.equal(told[i]!.reign, told[i - 1]!.reign + 1, "each reign once, none skipped");
  assert.ok(
    told.some((x) => !x.fell),
    "a succession within a house",
  );
  assert.equal(
    farReignsOf(world)!.of(unheard.ref),
    undefined,
    "nothing kept of a people not heard",
  );
  assert.equal(farReignsOf(world)!.of(heard.ref)!.event, told.at(-1)!.ref);
});

test("an outlawing by name bites as far as its realm can act and reaches the group's lands", () => {
  assert.equal(namedBite(0.8, []), 0);
  assert.equal(namedBite(0, [1, 1]), 0);
  assert.ok(Math.abs(namedBite(0.8, [1, 0.5]) - 0.6) < 1e-9);
  assert.ok(namedBite(0.8, [0.2, 0.2]) < namedBite(0.8, [0.9, 0.9]), "far lands, less bite");
  assert.equal(namedBite(2, [1]), 1);
});
