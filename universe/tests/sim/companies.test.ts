// Hired companies on the field (sim/war/companies.ts): what a company does on a day goes by its pay and its prospects.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { World } from "../../src/kernel/index.ts";
import { COMPANY, companiesField, type CompanyAt, type Polity } from "../../src/sim/index.ts";
import { companiesTold } from "../../src/sim/war/companies.ts";

// (A world with no treasury kept: no realm has silver by it, so no foe can pay a company to come over.)
const world = { hasStore: () => false, peek: () => undefined } as unknown as World,
  sides = [{ ref: "pol:0:1" }, { ref: "pol:0:2" }] as unknown as [Polity, Polity],
  co = (unpaid: boolean, share = 0.2): CompanyAt => ({
    org: { id: 1, name: "Varn", kind: 0, members: 400, leader: { name: "X" } } as CompanyAt["org"],
    page: "org:pol:0:1:ev:0:9",
    reserve: unpaid ? 0 : 100,
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
  // (Its page and what it did, so the battle's page links it and the company's page lists its fields.)
  assert.deepEqual(told.coPage, [null, "org:pol:0:1:ev:0:9"]);
  assert.deepEqual(told.coHow, [null, "fought"]);
  const left = companiesTold(companiesField(world, sides, [co(true), null], [10, 100]).days)!;
  assert.deepEqual(left.coHow, ["left", null]);
});

// An unpaid company leaves its payer's pay the year its treasury has nothing by it (sim/order/groups.ts unpaidLeave).
test("a company leaves a payer whose treasury is empty, the year it is so; one that is paid, or paid in kind, stays", async () => {
  const { peopledWorld } = await import("../worlds.ts"),
    sim = await import("../../src/sim/index.ts"),
    { unpaidLeave, ORG_EVENTS } = await import("../../src/sim/order/groups.ts"),
    { FISC, TREASURY_STORE, moneyStore } = await import("../../src/sim/money/kept.ts"),
    { AIM } = await import("../../src/rules/index.ts"),
    w = peopledWorld("kestrel", 400, { start: "spread" }),
    ctx = sim.populationContext(w),
    store = sim.orgsOf(w)!,
    purse = moneyStore(w, TREASURY_STORE)!,
    living = sim.politiesOf(w).living(),
    [home, payer] = living;
  assert.ok(store && purse && home && payer);
  const org = (id: number, patron: string, aim: number) =>
      ({
        id,
        name: `Co${id}`,
        kind: 0,
        aim,
        aims: [],
        since: 390,
        event: home.event,
        home: home.seat,
        lands: [home.seat],
        basis: 0,
        identity: "",
        means: 0,
        standing: 1,
        leader: { name: "X" },
        leaders: 1,
        members: 300,
        wealth: 0,
        income: 0,
        takes: 0,
        gives: 0,
        violence: 0,
        power: 0,
        patron,
      }) as unknown as CompanyAt["org"],
    was = store.of(home.ref),
    record = {
      ...(was ?? {
        last: 399,
        next: 1,
        stakes: [],
        gather: [],
        suppression: 0,
        killings: 0,
        taken: 0,
        pays: 0,
        rising: 0,
        plot: 0,
        feds: [],
        gone: [],
      }),
      // (One in the payer's pay for the field; one it licenses to prey, which costs it nothing.)
      orgs: [org(901, payer.ref, AIM.hire), org(902, payer.ref, AIM.prey)],
    };
  store.put(home.ref, record as never);
  const row = [...(purse.get(payer.ref) ?? [])],
    told = () => w.events.all().filter((e) => e.type === ORG_EVENTS.unpaid.type).length,
    before = told();
  row[FISC.reserve] = 5000;
  purse.set(payer.ref, row);
  unpaidLeave(ctx, store, living, 400);
  assert.equal(store.of(home.ref)!.orgs[0]!.patron, payer.ref, "a paid company stays");
  assert.equal(told(), before);
  row[FISC.reserve] = 0;
  purse.set(payer.ref, row);
  unpaidLeave(ctx, store, living, 400);
  const now = store.of(home.ref)!.orgs;
  assert.equal(now[0]!.patron, undefined, "unpaid, it leaves");
  assert.equal(now[1]!.patron, payer.ref, "a licence is not pay");
  assert.equal(told(), before + 1);
  assert.equal(store.hiredList(payer.ref).length, 1);
  // (Left once: nothing more is told of it.)
  unpaidLeave(ctx, store, living, 401);
  assert.equal(told(), before + 1);
});
