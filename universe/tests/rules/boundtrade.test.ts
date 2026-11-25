import { test } from "node:test";
import assert from "node:assert/strict";
import { BOUND_TRADE, boundPrice, boundSale } from "../../src/rules/index.ts";

// The trade in bound people (rules/boundtrade.ts): sold from where a bound hand keeps his holder little to where he keeps him much.

test("no sale where a hand is worth no more there than here, or no more than his guard and the road", () => {
  assert.equal(boundSale(0.4, 0.4, 5000).count, 0);
  assert.equal(boundSale(0, BOUND_TRADE.keep + BOUND_TRADE.road, 5000).count, 0);
  assert.equal(boundSale(0.5, 0.2, 5000).count, 0);
});

test("the wider the gap the more are sold, of those there are to sell; too few is no sale", () => {
  const narrow = boundSale(0.1, 0.18, 5000),
    wide = boundSale(0.1, 0.6, 5000);
  assert.ok(wide.count > narrow.count && narrow.count > 0, `${narrow.count} ${wide.count}`);
  assert.equal(wide.count, Math.floor(5000 * BOUND_TRADE.share));
  assert.equal(boundSale(0.1, 0.6, 100).count, 0);
  assert.equal(boundSale(0.1, 0.6, 1e7).count, BOUND_TRADE.most);
});

test("a hand fetches what his work keeps over his guard in the working years he has left", () => {
  assert.equal(boundPrice(BOUND_TRADE.keep, 70), 0);
  assert.ok(boundPrice(0.5, 70) > boundPrice(0.3, 70));
  assert.ok(boundPrice(0.5, 200) > boundPrice(0.5, 70));
});
