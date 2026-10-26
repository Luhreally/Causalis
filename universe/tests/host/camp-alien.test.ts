// A band's crafts on a world where nothing rusts (Phase 54 M221): no ochre to grind, red or yellow —
// green earths and black — and the black chert of its shale, lydite, struck on the shale's pyrite
// for fire as Earth's grey chert is.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { populationContext } from "../../src/sim/index.ts";
import { ALIEN } from "../../src/host/planet.ts";
import { campCraft } from "../../src/host/camp.ts";
import { landCamps } from "../../src/host/land.ts";

const world = ALIEN.build(seedFromText("alien 16"));
world.runTo(20 * YEAR);
const lands = populationContext(world)
  .provinces.all()
  .map((p) => ({ cell: p.cell, people: p.total() }))
  .sort((a, b) => b.people - a.people || a.cell - b.cell)
  .slice(0, 10)
  .map((x) => x.cell);
const crafts = lands.flatMap((c) =>
  landCamps(world, c).map((camp) => campCraft(world, c, camp.tile)),
);

test("no ochre where nothing rusts", () => {
  assert.ok(crafts.length > 0, "some camps to look at");
  for (const c of crafts)
    assert.ok(
      c.pigment && !/ochre/.test(c.pigment.name),
      `a band grinds ${c.pigment?.name ?? "nothing"}`,
    );
});

test("the black chert of the shale strikes a light", () => {
  const lydite = crafts.filter((c) => c.stone.name === "lydite");
  assert.ok(lydite.length > 0, "a camp on shale or coal measures, knapping lydite");
  for (const c of lydite) assert.equal(c.fire, "strike-a-light");
});
