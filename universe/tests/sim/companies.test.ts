// Hired companies on the field (sim/war/companies.ts): what a company does on a day goes by its pay and its prospects.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { World } from "../../src/kernel/index.ts";
import { COMPANY, companiesField, type CompanyAt, type Polity } from "../../src/sim/index.ts";
import { companiesTold } from "../../src/sim/war/companies.ts";

// (A world with no treasury kept: no realm has silver by it, so no foe can pay a company to come over.)
const world = { hasStore: () => false } as unknown as World,
  sides = [{ ref: "pol:0:1" }, { ref: "pol:0:2" }] as unknown as [Polity, Polity],
  co = (unpaid: boolean, share = 0.2): CompanyAt => ({
    org: { id: 1, name: "Varn", kind: 0, members: 400, leader: { name: "X" } } as CompanyAt["org"],
    men: 400,
    share,
    unpaid,
  });

test("a paid company fights whatever the odds", () => {
  const f = companiesField(world, sides, [co(false), null], [50, 100]);
  assert.deepEqual(f.power, [50, 100]);
  assert.equal(f.days[0]!.how, "fought");
});

test("an unpaid company fights a day it expects to win and leaves one it does not, taking its strength", () => {
  const good = companiesField(world, sides, [co(true), null], [100, 100]);
  assert.equal(good.days[0]!.how, "fought");
  const bad = companiesField(world, sides, [co(true), null], [100 * COMPANY.leaves - 1, 100]);
  assert.equal(bad.days[0]!.how, "left");
  assert.ok(Math.abs(bad.power[0] - (100 * COMPANY.leaves - 1) * 0.8) < 1e-9);
  assert.equal(bad.power[1], 100);
});

test("the battle is told with each side's company by name, or not at all", () => {
  assert.equal(companiesTold([]), undefined);
  const told = companiesTold(companiesField(world, sides, [null, co(false)], [10, 10]).days)!;
  assert.equal(told.co[0], null);
  assert.match(told.co[1]!, /^the Varn /);
  assert.deepEqual(told.coMen, [0, 400]);
});
