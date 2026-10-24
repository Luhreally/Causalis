import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type SimTime } from "../../src/kernel/index.ts";
import { FOODS, G, MALE, OCC, PRINCIPLES } from "../../src/rules/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  CREDIT,
  POPULATION_EVENTS,
  creditOf,
  creditYear,
  loreOf,
  marketsOf,
  mouths,
  politiesOf,
  populationContext,
  row,
  type Polity,
} from "../../src/sim/index.ts";
import type { Block, PageModel } from "../../src/bridge/index.ts";
import { CREDIT_CONCEPTS } from "../../src/host/inspect/credit-concepts.ts";

// Phase 21 M143: credit, read — a house of lending's page, a land's debts, the ledger's houses,
// the chronicle's first, the book's concepts. The first light's world a century and a quarter on;
// its greatest realm's most peopled land with a town made by hand a market town that knows
// lending, a house risen there, and the realm's next land lent grain against a famine.
const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const ctx = populationContext(world),
  people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
  realm = [...politiesOf(world).living()]
    .filter((p) => p.members.length >= 2)
    .sort((a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1))[0]!,
  [lender, borrower] = [...realm.members]
    .filter((c) => ctx.settlements.inProvince(c).length > 0)
    .sort(
      (a, b) =>
        (ctx.provinces.get(b)?.total() ?? 0) - (ctx.provinces.get(a)?.total() ?? 0) || a - b,
    ) as [number, number],
  at = (k: number) => (world.now + k) as SimTime;
{
  const s = ctx.settlements.inProvince(lender)[0]!,
    prov = ctx.provinces.get(lender)!,
    m = marketsOf(world).of(lender),
    lore = loreOf(world);
  s.population = 5000;
  s.market ??= s.event;
  for (const id of ["currency", "banking"])
    if (!lore.get(lender, id))
      lore.learn(
        lender,
        id,
        { year: 125, event: s.event },
        PRINCIPLES.find((x) => x.id === id)!,
      );
  prov.counts.add(row(MALE, 5), OCC.trader, 2 * CREDIT.traders);
  m.move("made", G.grain, Math.ceil(12 * mouths(prov, ctx.life)) + 100000);
}
let k = 1;
while (!creditOf(world)!.houses.length && k < 400) creditYear(ctx, at(k++));
const house = creditOf(world)!.houses[0]!;
{
  const prov = ctx.provinces.get(borrower)!,
    m = marketsOf(world).of(borrower);
  for (const g of FOODS) m.take("used", g, m.stock[g]!);
  prov.lastFamine = world.events.emit({
    type: POPULATION_EVENTS.famine.type,
    subjects: [prov.ref],
    place: prov.ref,
    data: { fed: 400, people: prov.total() },
  });
  creditYear(ctx, at(k++));
}
const loan = creditOf(world)!.loans.find((l) => l.cell === borrower)!;
const page = (ref: string) => ask<PageModel>("page", { ref }),
  tabOf = (p: PageModel, id: string) => p.tabs.find((t) => t.id === id)!,
  rowsOf = (blocks: readonly Block[]) => blocks.flatMap((b) => (b.type === "facts" ? b.rows : []));

test("a house of lending's page: what it holds, is owed, lent, earned and lost; whom it lent to, and why it rose", () => {
  assert.ok(house && loan, "a house rose and lent");
  const p = page(house.ref);
  assert.equal(p.kind, "house");
  assert.equal(p.title.toLowerCase(), house.name.toLowerCase());
  const overview = tabOf(p, "overview"),
    rows = rowsOf(overview.blocks),
    labels = rows.map((r) => r.label);
  for (const l of ["It holds", "Owed it now", "Lent, ever", "Earned in interest", "It began"])
    assert.ok(labels.includes(l), `${l} told`);
  assert.equal(rows.find((r) => r.label === "It began")!.why, house.event);
  const owed = overview.blocks.find(
    (b) => b.type === "list" && b.title === "What is owed it, the most first",
  );
  assert.ok(owed && owed.type === "list" && owed.items.length === 1);
  assert.equal(owed.items[0]!.why, loan.event);
  // (No loan of it ended yet: no tab of them.)
  assert.ok(!tabOf(p, "loans"));
  assert.match(JSON.stringify(p.subtitle), /A house of lending in /);
});

test("a land's debts: what it owes and to whom, against its harvest, every loan it took", () => {
  const debt = tabOf(page(`cell:0:${borrower}`), "debt");
  assert.ok(debt, "a debt tab");
  const rows = rowsOf(debt.blocks);
  for (const l of ["It owes", "Against its harvest", "Borrowed, ever"])
    assert.ok(
      rows.some((r) => r.label === l),
      `${l} told`,
    );
  assert.ok(
    rows.every((r) => r.concept),
    "each a measure of a concept",
  );
  assert.equal(rows.find((r) => r.label === "It owes")!.why, loan.event);
  const loans = debt.blocks.find((b) => b.type === "list");
  assert.ok(loans && loans.type === "list" && loans.items.length === 1);
  // (A land that never borrowed has no debt tab.)
  assert.ok(!page(`cell:0:${lender}`).tabs.some((t) => t.id === "debt"));
});

test("the ledger sets every house side by side; the chronicle tells the first; the lending titled", () => {
  const ledger = tabOf(page("world:ledger"), "credit");
  assert.ok(ledger, "a credit tab");
  const table = ledger.blocks.find((b) => b.type === "table" && b.title === "Every house");
  assert.ok(table && table.type === "table" && table.rows.some((r) => r.ref === house.ref));
  const bars = ledger.blocks.find((b) => b.type === "bars");
  assert.ok(bars && bars.type === "bars" && bars.bars.some((x) => x.ref === house.ref));
  const firsts = tabOf(page("world:chronicle"), "firsts").blocks.find((b) => b.type === "table");
  assert.ok(firsts && firsts.type === "table");
  assert.ok(
    firsts.rows.some((r) => JSON.stringify(r.cells[0]).includes("A house of lending")),
    "the first house",
  );
  assert.equal(page(loan.event).title, "Grain lent against a famine");
  assert.equal(page(house.event).title, "A house of lending");
});

test("the book of concepts has a page for each of credit's concepts, each bound up with pages it has", () => {
  for (const [id, c] of Object.entries(CREDIT_CONCEPTS)) {
    const p = page(`concept:${id}`);
    assert.equal(p.title, c.title, id);
    const related = p.tabs[0]!.blocks.find((b) => b.type === "list" && b.title === "Bound up with");
    assert.ok(related && related.type === "list" && related.items.length >= 2, `${id} bound up`);
    for (const i of related.items)
      assert.notEqual(page(i.ref!).title, "The book of concepts", `${id}: ${i.ref} has a page`);
  }
});
