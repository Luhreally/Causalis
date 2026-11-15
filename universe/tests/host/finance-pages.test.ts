// A realm's money and its fears on the pages (host/inspect/finance.ts), on a real world: Earth's first light to year 440, when its
// first seats know banking and have sold debt. A realm that owes has a Money tab (what new debt would cost it, each part named; what
// it owes and to whom; its years), every realm that fears has a Fears tab with the four numbers behind each fear, the world's ledger
// has its Money and Camps tabs, the Camps lens reads every land, and the years kept beside the world keep each realm's money.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { landReadings, lensReading } from "../../src/host/lenses.ts";
import { yearsOf } from "../../src/host/years.ts";
import { creditOf, debtOf, financeOf, politiesOf } from "../../src/sim/index.ts";
import { REFUSALS_SHOWN } from "../../src/host/inspect/credit.ts";
import type { Block, PageModel } from "../../src/bridge/index.ts";

const world = EARTH.build(seedFromText("first light"));
world.runTo(440 * YEAR);
const store = financeOf(world)!,
  living = politiesOf(world).living(),
  page = (ref: string) => EARTH.queries.page!(world, { ref }) as PageModel,
  tab = (p: PageModel, id: string) => p.tabs.find((t) => t.id === id),
  BAD = /undefined|NaN|\[object|Infinity|\b(ev|pol|war|cell):\d+:\d+[^"]/;
const text = (blocks: readonly Block[]) =>
  JSON.stringify(blocks, (k, v) => (k === "ref" || k === "why" ? undefined : v));

test("a realm that owes has a Money tab: what new debt would cost it and why, what it owes and to whom, its years", () => {
  const owing = living.filter((p) => debtOf(store.of(p.ref)!) > 0);
  assert.ok(owing.length > 0, "some realm has sold debt by year 440");
  const p = owing.sort((a, b) => debtOf(store.of(b.ref)!) - debtOf(store.of(a.ref)!))[0]!,
    money = tab(page(p.ref), "money");
  assert.ok(money, "its Money tab");
  const facts = money.blocks.find((b) => b.type === "facts" && b.title === "Its debt");
  assert.ok(facts && facts.type === "facts");
  const cost = facts.rows.find((r) => r.label === "New debt would cost it");
  assert.ok(cost?.parts && cost.parts.length >= 3, "each part of its yield, one tap down");
  assert.ok(money.blocks.some((b) => b.type === "composition" && b.title === "Who holds its debt"));
  assert.doesNotMatch(text(money.blocks), BAD);
  // Its years are kept beside the world: what it pays, what it owes.
  const log = yearsOf(world)!.realms.get(p.ref)!;
  assert.ok(log.rate && log.rate.v.length > 0 && log.owed && log.owed.v.length > 0);
});

test("every realm's Fears tab reads its fears in words, with the four numbers behind each", () => {
  let fearing = 0;
  for (const p of living) {
    const m = store.of(p.ref)!,
      fears = tab(page(p.ref), "fears");
    assert.ok(fears, `${p.ref} has its Fears tab`);
    assert.doesNotMatch(text(fears.blocks), BAD);
    const top = m.fears[0];
    if (!top || top.level < 10) continue;
    fearing++;
    const all = text(fears.blocks);
    assert.match(all, /would lose by it/);
    const rows = fears.blocks.find((b) => b.type === "facts" && b.title?.startsWith("Its fears"));
    assert.ok(rows && rows.type === "facts" && rows.rows[0]!.parts!.length >= 5);
  }
  assert.ok(fearing > 0, "some realm fears another's way");
});

test("the world's ledger has its Money and Camps tabs, read without a broken word", () => {
  const ledger = page("world:ledger"),
    money = tab(ledger, "money"),
    camps = tab(ledger, "camps");
  assert.ok(money && camps);
  assert.doesNotMatch(text(money.blocks), BAD);
  assert.doesNotMatch(text(camps.blocks), BAD);
  assert.ok(money.blocks.some((b) => b.type === "table" && b.title === "Every realm's money"));
  assert.ok(camps.blocks.some((b) => b.type === "table" && b.title === "The greatest fears"));
});

test("the Camps lens reads every peopled land: a number -1 … 1 (-2 a land of no realm), and its words", () => {
  const read = landReadings(world);
  let seen = 0;
  for (const p of living)
    for (const c of p.members.slice(0, 2)) {
      const v = read(c).camps;
      assert.ok(v >= -1 && v <= 1, `${c}: ${v}`);
      const words = lensReading(world, c, "camps");
      assert.ok(words && words.stats.some((s) => s.label === "Held"));
      assert.doesNotMatch(JSON.stringify(words), BAD);
      seen++;
    }
  assert.ok(seen > 10);
});

test("a realm that has refused its debts many times tells a count and the last few, not a wall of lines", () => {
  const p = living.find((x) => debtOf(store.of(x.ref)!) > 0)!,
    credit = creditOf(world)!,
    before = credit.defaults.length;
  // (A dozen refusals laid on it by hand, each told by its founding's event: what a hungry world's realm comes to.)
  for (let k = 0; k < 12; k++)
    credit.defaults.push({ realm: p.ref, year: 300 + 10 * k, event: p.event });
  try {
    const page_ = page(p.ref),
      list = tab(page_, "credit")!.blocks.find(
        (b) => b.type === "list" && b.title?.startsWith("Debts repudiated and released"),
      );
    assert.ok(list && list.type === "list");
    assert.equal(list.items.length, REFUSALS_SHOWN);
    assert.equal(list.more, 12 - REFUSALS_SHOWN);
    assert.match(list.title!, /12 times, the last 4/);
    const money = tab(page_, "money")!.blocks.find((b) => b.type === "facts");
    assert.ok(money && money.type === "facts");
    const row = money.rows.find((r) => r.label === "Debts refused");
    assert.match(
      JSON.stringify(row?.value),
      /12 times in the 200 years remembered, the last in year 410/,
    );
  } finally {
    credit.defaults.length = before;
  }
});
