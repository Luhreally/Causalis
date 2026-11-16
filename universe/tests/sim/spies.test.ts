// Spies sent where a realm has most reason to watch, caught as the realm they are in watches its people (sim/war/spies.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type SimTime } from "../../src/kernel/index.ts";
import {
  SPYING,
  SPY_EVENTS,
  misreadOf,
  orderOf,
  politiesOf,
  populationContext,
  spiesOf,
  spiesYear,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("kestrel", 400, { start: "spread" }),
  ctx = populationContext(world);

test("a spy in a realm reads its host truly; one in a realm that watches every word and keeps every arm is caught", () => {
  const store = spiesOf(world)!,
    [a, b] = politiesOf(world).living(),
    year = Math.floor(world.now / YEAR) + 1;
  assert.ok(a && b);
  for (const r of store.realms())
    assert.ok(store.of(r).length <= SPYING.most, `${r} keeps ${store.of(r).length}`);
  store.set(a.ref, [{ in: b.ref, since: year - 1 }]);
  assert.equal(misreadOf(world, a.ref, b.ref, year), 1);
  // (The realm it is in made one that watches every word and keeps every arm: caught within a few years at most.)
  const o = orderOf(world)!.of(b.ref)!;
  o.held![0] = 100;
  o.held![2] = 0;
  let caught = false;
  for (let y = year; y < year + 40 && !caught; y++) {
    spiesYear(ctx, (y * YEAR) as SimTime);
    caught = !store.has(a.ref, b.ref);
    if (!caught) continue;
    const e = world.events
      .all()
      .findLast((x) => x.type === SPY_EVENTS.caught.type && x.subjects[0] === b.ref);
    // (Caught, told, and none sent back in the year it was caught.)
    assert.ok(e, "caught, and not told");
    assert.match(why(world, e.id).claim, /caught a spy/);
  }
  assert.ok(caught, "never caught in forty years");
});
