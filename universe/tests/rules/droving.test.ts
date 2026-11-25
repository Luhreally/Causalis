import { test } from "node:test";
import assert from "node:assert/strict";
import { DROVE, drovePays, droveWorth } from "../../src/rules/index.ts";

// Seasonal herding (rules/droving.ts): flocks driven to a neighbour's pasture where the grass gained is worth the road.

const YEAR = 365;

test("herders who graze their own pasture hard gain by a neighbour's spare grass; those with pasture to spare do not", () => {
  const pressed = droveWorth(1000, 3000, { spare: 2000, grows: 0.5, km: 200 }, YEAR),
    easy = droveWorth(1000, 50, { spare: 2000, grows: 0.5, km: 200 }, YEAR);
  assert.ok(drovePays(pressed.gain), `pressed ${pressed.gain}`);
  assert.ok(!drovePays(easy.gain), `easy ${easy.gain}`);
});

test("a longer season gives more, a longer road less; too far and no one goes", () => {
  const near = droveWorth(1000, 3000, { spare: 2000, grows: 0.5, km: 100 }, YEAR),
    far = droveWorth(1000, 3000, { spare: 2000, grows: 0.5, km: 500 }, YEAR),
    short = droveWorth(1000, 3000, { spare: 2000, grows: 0.1, km: 100 }, YEAR);
  assert.ok(near.gain > far.gain);
  assert.ok(near.gain > short.gain);
  assert.equal(droveWorth(1000, 3000, { spare: 2000, grows: 0.5, km: 5000 }, YEAR).gain, 1);
  assert.ok(Math.abs(near.road - 200 / (DROVE.day * YEAR)) < 1e-12);
  // (A world with a longer year spends less of it on the same road.)
  assert.ok(droveWorth(1000, 3000, { spare: 2000, grows: 0.5, km: 500 }, 700).gain > far.gain);
});

test("no spare grass, or grass that never grows, is nothing to go for", () => {
  assert.equal(droveWorth(1000, 3000, { spare: 0, grows: 0.5, km: 100 }, YEAR).gain, 1);
  assert.equal(droveWorth(1000, 3000, { spare: 2000, grows: 0, km: 100 }, YEAR).gain, 1);
});
