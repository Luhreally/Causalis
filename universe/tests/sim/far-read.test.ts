// History reads a followed people's own world only once its years come (sim/space/contact.ts civilizationsBy): all it
// asks of their years in a year is whether that year has come to them, and a reading only ever puts a year later, so
// the list a year reads answers every such question as the whole reading does. And the same list, read or not since.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { civilizationsEver, civilizationsNear } from "../../src/sim/index.ts";

test("a year's list of the followed answers whether each year has come as the whole reading does", () => {
  const world = EARTH.build(seedFromText("first light")),
    raw = civilizationsEver(world),
    early = civilizationsNear(world, 0),
    whole = civilizationsNear(world);
  assert.equal(whole.length, raw.length);
  assert.ok(
    whole.some((c, i) => c.stars !== raw[i]!.stars),
    "some followed people's own world shuts a road to it",
  );
  for (const year of [-500, 0, 1, 100, 300, 482, 700, 950, 1050, 1676, 2500, 3100]) {
    const by = civilizationsNear(world, year);
    for (const [i, c] of whole.entries()) {
      const b = by[i]!;
      assert.equal(b.ref, c.ref);
      for (const k of ["electronics", "orbit", "stars"] as const)
        assert.equal(
          b[k] <= year,
          c[k] <= year,
          `${c.ref} ${k} in ${year}: ${b[k]} against ${c[k]}`,
        );
      // (Never later than the whole reading, never earlier than first read.)
      for (const k of ["electronics", "orbit", "stars"] as const)
        assert.ok(b[k] <= c[k] && b[k] >= raw[i]![k], `${c.ref} ${k}`);
    }
  }
  // (Read since or not, the same list for the same year.)
  assert.deepEqual(
    civilizationsNear(world, 0).map((c) => [c.ref, c.electronics, c.orbit, c.stars]),
    early.map((c) => [c.ref, c.electronics, c.orbit, c.stars]),
  );
});
