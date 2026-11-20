// Who leads a people of another star (sim/space/far-rulers.ts): read off the people and the year, the same each time; reigns
// follow one another without a gap; a house holds the seat over several of them; who leads bends their people's nature a little.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  FAR_RULE,
  civilizationsNear,
  farHouseOf,
  farRulerOf,
  peopleNature,
  peopleTemper,
} from "../../src/sim/index.ts";
import { civBody } from "../../src/gen/index.ts";
import { keepsPersons } from "../../src/rules/index.ts";

for (const seed of ["first light", "tide 207"]) {
  const world = EARTH.build(seedFromText(seed)),
    civs = civilizationsNear(world);

  test(`${seed}: every far people with years of its own is led by someone, reign after reign`, () => {
    assert.ok(civs.length >= 1, `${civs.length} peoples`);
    let houses = 0,
      reigns = 0;
    for (const c of civs) {
      if (!Number.isFinite(c.offset)) continue;
      assert.equal(
        farRulerOf(world, c, Math.ceil(c.offset) - 1),
        null,
        "no one before its chronicle",
      );
      let r = farRulerOf(world, c, Math.ceil(c.offset) + 5)!;
      assert.ok(r, "someone leads from its first years");
      const names = new Set<string>(),
        took = new Set<number>();
      for (let n = 0; n < 60; n++) {
        assert.deepEqual(farRulerOf(world, c, r.since), r, "the same each time");
        assert.deepEqual(farRulerOf(world, c, r.until - 1), r, "to the end of the reign");
        assert.ok(r.until > r.since && r.name.length >= 2);
        assert.equal(r.many, !keepsPersons(civBody(c)?.social));
        for (const b of r.bent) assert.ok(Math.abs(b) <= FAR_RULE.bent + 1e-9);
        const h = farHouseOf(world, c, r.since)!;
        assert.ok(h.from <= r.reign && h.reigns === r.reign - h.from + 1);
        took.add(h.from);
        names.add(r.name);
        const next = farRulerOf(world, c, r.until)!;
        assert.equal(next.reign, r.reign + 1, "no gap and no reign skipped");
        assert.equal(next.since, r.until);
        r = next;
        reigns++;
      }
      assert.ok(names.size >= 30, `${names.size} names in 60 reigns`);
      houses += took.size;
    }
    // (A house holds the seat some five reigns: neither every reign a new one, nor one for ever.)
    assert.ok(
      houses > reigns / 12 && houses < reigns / 2,
      `${houses} houses over ${reigns} reigns`,
    );
  });

  test(`${seed}: a people's nature is its own, bent by who leads it`, () => {
    world.runTo(2 * YEAR);
    let bent = 0;
    for (const c of civs) {
      const own = peopleTemper(world, c),
        now = peopleNature(world, c),
        r = farRulerOf(world, c, 2);
      if (!r) {
        assert.deepEqual(now, own);
        continue;
      }
      for (const k of ["curious", "wary", "bold", "trading"] as const) {
        assert.ok(Math.abs(now[k] - own[k]) <= FAR_RULE.bent + 1e-9);
        if (now[k] !== own[k]) bent++;
      }
    }
    assert.ok(bent > 0, "someone's leading shows");
  });
}
