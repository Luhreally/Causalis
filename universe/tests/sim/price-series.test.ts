// A market's prices kept for the charts (sim/economy/market.ts): every year for a century, every tenth for five, every fiftieth past.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Market } from "../../src/sim/economy/market.ts";
import { PRICE_CENTURIES, PRICE_YEARS } from "../../src/sim/index.ts";

test("a market's price series thins with age: yearly for a century, by the decade to five, by the half-century past", () => {
  const m = new Market(3);
  for (let y = 0; y <= 800; y++) m.closeYear(y);
  const years = (m.save() as { series: { year: number }[] }).series.map((p) => p.year);
  assert.deepEqual(
    years,
    [...years].sort((a, b) => a - b),
    "in order",
  );
  const age = (y: number) => 800 - y;
  assert.ok(years.filter((y) => age(y) < PRICE_YEARS).length >= PRICE_YEARS - 1);
  assert.ok(
    years
      .filter((y) => age(y) > PRICE_YEARS && age(y) < PRICE_CENTURIES)
      .every((y) => y % 10 === 0),
  );
  assert.ok(years.filter((y) => age(y) > PRICE_CENTURIES).every((y) => y % 50 === 0));
  assert.ok(years.includes(0) && years.includes(250) && !years.includes(260));
  assert.ok(years.length < 100 + 40 + 7 + 2);
});
