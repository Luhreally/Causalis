// The breadth round's economy and technology rules, as pure functions: variety within a class, time preference and interest,
// saving, exchange between moneys, what a town's building is worth, grants of sole use, lock-in.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CIVICS,
  G,
  HUMANLIKE,
  PRINCIPLES,
  RECIPES,
  RIVALS,
  adultHazard,
  civicsPaying,
  exchangeRate,
  exchangeRisk,
  fuelMix,
  grantPull,
  grantTerm,
  grantsPay,
  kindNames,
  kindsIn,
  loanRate,
  lockedIn,
  lossShare,
  payingPeople,
  savedShare,
  timePreference,
  useWorth,
  varietyGain,
  varietyIndex,
  type TownUse,
} from "../../src/rules/index.ts";

const bit = (id: string) => 1 << RECIPES.findIndex((r) => r.id === id);

test("a class's kinds are the ways of making it that were worked", () => {
  const mask = bit("stone-tools") | bit("iron-tools") | bit("weaving");
  assert.equal(kindsIn(mask, G.tools), 2);
  assert.equal(kindsIn(mask, G.clothing), 1);
  assert.equal(kindsIn(mask, G.pottery), 0);
  assert.deepEqual(kindNames(mask, G.tools), ["stone tools", "iron tools"]);
});

test("more kinds serve more, and lower the price index; one kind changes nothing", () => {
  assert.equal(varietyGain(1), 1);
  assert.equal(varietyGain(0), 1);
  assert.ok(varietyGain(3) > varietyGain(2) && varietyGain(2) > 1);
  assert.ok(Math.abs(varietyIndex(2) * varietyGain(2) - 1) < 1e-12);
  assert.ok(useWorth(G.clothing, 10, 1, 3) > useWorth(G.clothing, 10, 1, 1));
  assert.equal(useWorth(G.grain, 10, 1, 3), 1);
});

test("a fuel class's stock is read by what the land drew of each kind, else its first kind", () => {
  assert.deepEqual(fuelMix({ oil: 30, gas: 10 }, G.oil, "oil"), { oil: 0.75, gas: 0.25 });
  assert.deepEqual(fuelMix({}, G.coal, "coal"), { coal: 1 });
  assert.deepEqual(fuelMix({ sulphur: 5 }, G.coal, "coal"), { sulphur: 1 });
});

test("time preference is the body's hazard, the higher in a hungry year; interest makes good the losses", () => {
  const h = adultHazard(HUMANLIKE);
  assert.ok(h > 0.01 && h < 0.03, `hazard ${h}`);
  assert.ok(timePreference(h, 0.5) > timePreference(h, 1));
  assert.equal(loanRate(0.02, 0), 0.020000000000000018);
  assert.ok(loanRate(0.02, 0.1) > 0.13);
  // Before any books a lender fears losing a loan as often as a borrower dies.
  assert.ok(Math.abs(lossShare(0, 0, h) - h) < 1e-9);
  assert.ok(lossShare(5, 10, h) > lossShare(0, 10, h));
  // The patient put more by at the same rate.
  assert.ok(savedShare(0.03, 0.01) > savedShare(0.03, 0.03));
});

test("one realm's money fetches another's by their price levels; the cost of changing is how they moved", () => {
  assert.equal(exchangeRate(2, 6), 3);
  assert.equal(exchangeRisk(0.1, 0.1, true), 0);
  assert.equal(exchangeRisk(0.5, 0, false), 0);
  assert.ok(exchangeRisk(0.4, 0, true) > exchangeRisk(0.1, 0, true));
});

const town = (people: number, crafters = 0.1, preference = 0.04): TownUse => ({
  people,
  share: [1, crafters, 0.03, 0.01, 0.35],
  worth: [1, 1, 1.5, 2, 1],
  preference,
});

test("a building rises where its use pays for its cost: bigger towns, more patient peoples, more of those it serves", () => {
  const mill = CIVICS.find((c) => c.kind === "mill")!,
    kiln = CIVICS.find((c) => c.kind === "kiln")!;
  const least = payingPeople(mill, 2, town(1000));
  assert.ok(least > 50 && least < 2000, `mill pays at ${least}`);
  assert.equal(civicsPaying(mill, 2, town(Math.floor(least) - 1)), 0);
  assert.equal(civicsPaying(mill, 2, town(Math.ceil(least) + 1)), 1);
  assert.ok(payingPeople(mill, 2, town(1000, 0.1, 0.01)) < least);
  assert.ok(payingPeople(kiln, 1, town(1000, 0.3)) < payingPeople(kiln, 1, town(1000, 0.05)));
  // More rise as each serves the next of its people, never past `most`.
  assert.ok(civicsPaying(mill, 2, town(20_000)) > 1);
  assert.ok(civicsPaying(mill, 2, town(10_000_000)) <= (mill.most ?? 99));
  const well = CIVICS.find((c) => c.kind === "well")!;
  assert.equal(civicsPaying(well, 1, town(1e9)), 0);
});

test("grants: a term as far as the people look ahead, a pull on finding, granted where it pays", () => {
  assert.ok(grantTerm(0.02) > grantTerm(0.1));
  assert.ok(grantPull(0.03) > 1 && grantPull(0.03) < 3);
  assert.ok(grantsPay(10, 1, 0.03));
  assert.ok(!grantsPay(1, 20, 0.03));
});

test("lock-in: a rival way built on holds back a new one while what was built stands", () => {
  const [id, rivals] = [...RIVALS][0]!;
  const p = PRINCIPLES.find((x) => x.id === id)!,
    q = rivals[0]!;
  assert.equal(lockedIn(p, 500, () => undefined).hold, 1);
  const fresh = lockedIn(p, 500, (x) => (x === q.id ? 499 : undefined)).hold,
    old = lockedIn(p, 500, (x) => (x === q.id ? 300 : undefined)).hold;
  assert.ok(fresh < old && old <= 1, `${fresh} ${old}`);
  // Nothing a principle stands on is its rival.
  for (const [pid, list] of RIVALS) {
    const pp = PRINCIPLES.find((x) => x.id === pid)!;
    for (const r of list) assert.ok(!pp.needs.some((n) => n.split("|").includes(r.id)));
  }
});
