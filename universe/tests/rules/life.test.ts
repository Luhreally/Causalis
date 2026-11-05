import { test } from "node:test";
import assert from "node:assert/strict";
import { OCC } from "../../src/rules/species.ts";
import {
  HOME_COST,
  blockEnd,
  dayWage,
  lifeOffers,
  reckon,
  wantNow,
  workHours,
  type Life,
  type LifeFacts,
} from "../../src/rules/life.ts";

const DAY = 86_400,
  fresh = (more: Partial<Life> = {}): Life => ({
    agent: 1,
    name: "A",
    event: "e",
    began: 0,
    home: 0,
    generation: 1,
    settled: 0,
    fed: 0.8,
    rested: 0.8,
    heart: 0.6,
    purse: 100,
    standing: 10,
    skill: 0,
    tool: 0,
    finery: 0,
    owned: false,
    short: false,
    doing: null,
    habit: 0,
    want: null,
    wantsDone: 0,
    rival: -1,
    rivalLuck: 0.5,
    bonds: [],
    kin: [],
    suitors: [],
    taught: 0,
    extra: 0,
    asked: [],
    waiting: [],
    log: [],
    ended: "",
    ...more,
  }),
  farmer: LifeFacts = {
    age: 30,
    adulthood: 16,
    occupation: OCC.farmer,
    mouths: 5,
    others: 2.24,
    bread: 0.58,
    ratio: 0.58,
    partnered: true,
    children: 3,
  };

test("a working day is eight hours, whatever the span", () => {
  assert.equal(workHours(0, DAY), 8);
  assert.equal(workHours(0, 10 * DAY), 80);
  assert.equal(workHours(9 * 3600, 10 * 3600), 1);
  assert.equal(workHours(12 * 3600, 13 * 3600), 0);
});

test("a span in one step comes to the same as the same span in two", () => {
  const a = fresh(),
    b = fresh();
  reckon(a, farmer, 40 * DAY);
  reckon(b, farmer, 17 * DAY);
  reckon(b, farmer, 40 * DAY);
  assert.ok(Math.abs(a.purse - b.purse) < 1e-6);
  assert.ok(Math.abs(a.skill - b.skill) < 1e-6);
});

test("a farmer's household with three children gets ahead at a glut's prices, slowly", () => {
  const l = fresh();
  reckon(l, farmer, 365 * DAY);
  assert.ok(l.purse > 300 && l.purse < 900, `after a year: ${l.purse}`);
  assert.equal(l.short, false);
});

test("a famine empties the purse, and they go short", () => {
  const l = fresh();
  reckon(l, { ...farmer, bread: 3, ratio: 2, others: 6 }, 60 * DAY);
  assert.equal(l.purse, 0);
  assert.equal(l.short, true);
  reckon(l, { ...farmer, bread: 3, ratio: 2, others: 6 }, 120 * DAY);
  assert.ok(l.fed < 0.5);
});

test("a block's hours are reckoned, and work past the day's hours counted apart", () => {
  const l = fresh({
    settled: 18 * 3600,
    doing: { what: "work", from: 18 * 3600, to: 22 * 3600, target: -1 },
  });
  const s = reckon(l, farmer, 22 * 3600);
  assert.equal(s.past, 4);
  assert.equal(l.doing, null);
  assert.ok(l.rested < 0.8);
});

test("skill and tools pay; sleep runs to six; a home is wanted until it can be paid for", () => {
  assert.ok(dayWage(OCC.crafter, 8000, 3, 1) > dayWage(OCC.crafter, 0, 0, 1));
  assert.equal(blockEnd("sleep", 22 * 3600), DAY + 6 * 3600);
  assert.equal(blockEnd("sleep", 3 * 3600), 6 * 3600);
  const none = { partnered: false, children: 0 };
  assert.equal(wantNow("home", fresh(), none, null).done, false);
  assert.equal(wantNow("home", fresh({ purse: HOME_COST }), none, null).done, true);
});

test("the tray says why, puts a low need first, and greys what is under way", () => {
  const offers = lifeOffers(
    fresh({ fed: 0.1, doing: { what: "work", from: 0, to: 1, target: -1 } }),
    farmer,
    {
      hour: 9,
      children: [{ id: 7, name: "Ilo" }],
      suitors: [],
      rival: null,
      atWar: false,
      shrine: false,
    },
  );
  assert.equal(offers[0]!.what, "eat");
  assert.equal(offers.find((o) => o.what === "work")!.can, false);
  assert.ok(offers.some((o) => o.label === "Teach Ilo"));
  assert.ok(offers.every((o) => o.words.length > 0));
});
