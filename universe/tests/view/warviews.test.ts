import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BATTLE_DAY,
  WAR_VIEWS,
  WAR_VIEW_WORDS,
  battleSpan,
  foughtNow,
  warViewsClosed,
} from "../../src/view/index.ts";

const HOUR = 3600,
  DAY = 86_400,
  YEAR = 365 * DAY;
// A battle of year 364, fought at the turn of year 365.
const b = { war: "war:0:7", event: "ev:0:9:1", cell: 12, year: 364 },
  at = (s: number) => 365 * YEAR + s;

test("the four views, from the whole world down to the field, each named and told", () => {
  assert.deepEqual(WAR_VIEWS, ["globe", "land", "town", "field"]);
  for (const v of WAR_VIEWS) {
    const w = WAR_VIEW_WORDS[v];
    assert.ok(w.icon && w.words && w.title, v);
  }
});

test("before its town only from the morning it is fought until its fallen are buried; the rest at any time", () => {
  // (The eve: not fought yet — its record is the turn's.)
  for (const t of [at(-HOUR), at(BATTLE_DAY.buried), at(200 * DAY), 300 * YEAR])
    assert.deepEqual(Object.keys(warViewsClosed(b, t)), ["town"], `${t}`);
  for (const t of [at(0), at(9 * HOUR), at(DAY), at(BATTLE_DAY.buried - 1)])
    assert.deepEqual(warViewsClosed(b, t), {}, `${t}`);
  assert.match(warViewsClosed(b, at(200 * DAY)).town!, /turn of year 364/);
});

test("fought from its eve, through the morning, until the beaten fly: gone into before its town; else onto its field", () => {
  const { to } = battleSpan(365);
  for (const t of [at(BATTLE_DAY.eve), at(-HOUR), at(0), at(5 * HOUR), at(9 * HOUR), to - 1])
    assert.equal(foughtNow(t, 365), true, `${t}`);
  for (const t of [at(BATTLE_DAY.eve - 1), at(-30 * DAY), to, at(12 * HOUR), at(DAY), 366 * YEAR])
    assert.equal(foughtNow(t, 365), false, `${t}`);
});
