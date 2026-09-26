import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { generateHomeWorld } from "../../src/gen/index.ts";
import {
  CLADES,
  HUMANLIKE,
  OPEN,
  growthOf,
  bodyOf,
  lifeHistoryOf,
  type LifeHistory,
} from "../../src/rules/index.ts";
import { ALIEN } from "../../src/host/planet.ts";
import { adults, lifeOf, populationContext } from "../../src/sim/index.ts";

test("a people's life table is the upright apes' stretched to its span, growing at plenty no faster than they do", () => {
  const cond = { warmth: 18, rain: 800, gravity: 1, ocean: 0.7 },
    apes = growthOf(HUMANLIKE);
  assert.equal(lifeHistoryOf(CLADES.find((c) => c.id === "ape")!.body), HUMANLIKE);
  for (const clade of CLADES) {
    const body = bodyOf(clade, cond, [0.5, 0.5, 0.5]),
      life = lifeHistoryOf(body),
      k = body.span / 70,
      g = growthOf(life);
    // However many young at a birth, the first years take their share, so a people grows
    // at the chronicle's pace, the apes' (a long life with few young, a little slower).
    assert.ok(g <= 1.02 * apes, `${clade.id}: ${g} against ${apes}`);
    if (k <= 1) assert.ok(Math.abs(g - apes) < 0.05 * apes, `${clade.id}: ${g} against ${apes}`);
    assert.equal(life.adulthood, Math.max(1, Math.round(15 * k)));
    // A body eats by its size (to the three-quarters), half as much with cold blood.
    assert.ok(
      Math.abs(life.appetite - Math.pow(body.size / 60, 0.75) * (body.warm ? 1 : 0.5)) < 1e-9,
    );
  }
});

test("a people of another body lives by its own life table, and thrives", () => {
  // The first open world whose people are not apes.
  let seed = "";
  for (let i = 0; i < 40 && !seed; i++) {
    const p = generateHomeWorld(seedFromText(`alien ${i}`), OPEN).life.people;
    if (p && p.body.clade !== "ape" && p.body.clade !== "trunk") seed = `alien ${i}`;
  }
  const world = ALIEN.build(seedFromText(seed)),
    ctx = populationContext(world),
    life = lifeOf(world);
  assert.notEqual(life, HUMANLIKE);
  assert.equal(ctx.life, life);
  const count = () => ctx.provinces.all().reduce((s, p) => s + p.total(), 0),
    first = count();
  world.runTo(60 * YEAR);
  assert.ok(count() > first, `${count()} people from ${first}`);
  // Its grown are those past its own coming of age, and they work.
  const p = [...ctx.provinces.all()].sort((a, b) => b.total() - a.total())[0]!;
  assert.ok(adults(p, life) > 0 && adults(p, life) < p.total());
});
