// What a people must have put by to see its reaping in, and how its births answer to what it holds of that.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HARVEST, LEAN_MONTHS, THRIFT, storeNeeded, thrift } from "../../src/rules/index.ts";

test("what must be held at the turn of a year is the months to the reaping's end, by the share of food that is reaped", () => {
  // A people who live by their fields alone: the months until the reaping is done, and the fortnight under which a
  // granary is lean.
  assert.equal(storeNeeded(1), 12 * HARVEST[1] + LEAN_MONTHS);
  assert.ok(storeNeeded(1) > 9 && storeNeeded(1) < 11, `${storeNeeded(1)} months`);
  // Those who gather, hunt and herd eat what the year brings month by month: only the fortnight.
  assert.equal(storeNeeded(0), LEAN_MONTHS);
  // Between: by the share reaped, evenly; never read past all or under none of it.
  assert.equal(storeNeeded(0.5), (storeNeeded(0) + storeNeeded(1)) / 2);
  assert.equal(storeNeeded(2), storeNeeded(1));
  assert.equal(storeNeeded(-1), storeNeeded(0));
});

test("a people's births answer smoothly to its store: all of them with what it needs put by, none with nothing", () => {
  const need = storeNeeded(1);
  assert.equal(thrift(need, 1), 1);
  assert.equal(thrift(2 * need, 1), 1, "no more children for a granary overfull");
  assert.equal(thrift(0, 1), 0);
  // No cliff: each month more put by is more kept, and a month short of the whole costs little.
  let last = 0;
  for (let m = 0.5; m <= need; m += 0.5) {
    const now = thrift(m, 1);
    assert.ok(now > last, `${m} months`);
    assert.ok(now - last < 0.25, `a step of ${now - last} at ${m} months`);
    last = now;
  }
  assert.ok(thrift(need - 1, 1) > 0.75);
  // By the share held, raised as hunger is.
  assert.equal(thrift(need / 2, 1), 0.5 ** THRIFT);
  // The same store is plenty for those who reap little of what they eat.
  assert.equal(thrift(1, 0), 1);
  assert.ok(thrift(3, 0.25) > thrift(3, 1));
});
