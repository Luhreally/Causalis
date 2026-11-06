// Wild lives (Z1): a land's number goes where the green is and walks in only from what is there; a year's way is a reading.
import { test } from "node:test";
import assert from "node:assert/strict";
import { beastByName, herdHolds, herdStep, passAt, passWindows } from "../../src/rules/index.ts";

test("a land holds less under fields, towns and flocks, and says what holds it down", () => {
  const open = { green: 0.8, niche: "grazer", woods: 0, rain: 1, wild: 1, density: 0, flocks: 0 },
    a = herdHolds(open).holds,
    b = herdHolds({ ...open, density: 1000 });
  assert.ok(b.holds < a / 2);
  assert.equal(b.why, "towns");
  assert.ok(herdHolds({ ...open, flocks: 3 }).holds < a);
  assert.equal(herdHolds({ ...open, flocks: 3 }).why, "flocks");
});

test("nothing walks in with nothing there or beside it; they leave faster than they come", () => {
  assert.equal(herdStep(0, 80, 0), 0);
  assert.ok(herdStep(0, 80, 50) > 0);
  assert.ok(herdStep(10, 80, 50) < 80);
  assert.ok(herdStep(80, 10, 0) < 80);
});

test("a herd comes and goes through the year: gone part of it, and still on a world with no seasons", () => {
  const pass = { rank: 0.5, width: 0.2 };
  let on = 0;
  for (let i = 0; i < 96; i++) if (passAt(pass, i / 96) !== null) on++;
  assert.ok(on > 0 && on < 96);
  assert.equal(passWindows(pass).length, 2);
  assert.equal(passWindows({ rank: 1, width: 0.2 }).length, 1);
  assert.equal(passAt({ rank: 0, width: 1, still: true }, 0.3), 0);
});

test("a beast is named from what it is, and never for anything but that", () => {
  const n = beastByName("red tusked colossus", null, 3);
  assert.match(n, /^the Red /);
});
