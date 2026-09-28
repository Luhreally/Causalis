import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { GOODS } from "../../src/rules/index.ts";
import { flowOf, storesSummed } from "../../src/host/inspect/stores.ts";
import { politiesOf, type MarketStore } from "../../src/sim/index.ts";
import type { Block, PageModel, Tip } from "../../src/bridge/index.ts";

// Phase 15 M122: matter's pages — substances, reactions, principles, goods — and a good in a
// land made of something, made there or not and why. The first light's world at year 260.
const world = EARTH.build(seedFromText("first light"));
world.runTo(260 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const page = (ref: string) => ask<PageModel>("page", { ref });
const blocks = (p: PageModel, tab = "overview") => p.tabs.find((t) => t.id === tab)?.blocks ?? [];
const of = <K extends Block["type"]>(list: readonly Block[], type: K) =>
  list.filter((b): b is Extract<Block, { type: K }> => b.type === type);
const links = (p: PageModel): string[] => {
  const out: string[] = [];
  const walk = (x: unknown) => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      if (typeof o.ref === "string" && typeof o.text === "string") out.push(o.ref);
      Object.values(o).forEach(walk);
    }
  };
  walk(p.tabs);
  walk(p.stats);
  return out;
};

test("a substance: its elements, how it is, where it lies in this world, what it becomes", () => {
  const p = page("subst:malachite");
  assert.equal(p.kind, "substance");
  const elements = of(blocks(p), "composition")[0]!;
  assert.equal(elements.title, "Its elements");
  const cu = elements.parts.find((x) => String(x.name[0]).startsWith("Copper"))!;
  assert.ok(Math.abs(cu.share - 0.575) < 0.002, `copper ${cu.share}`);
  const where = of(blocks(p), "list").find((b) => b.title === "Where it lies in this world")!;
  assert.ok(where.items.length > 0, "copper lies somewhere in this world");
  const reactions = of(blocks(p, "reactions"), "list")[0]!;
  assert.ok(reactions.items.some((i) => i.ref === "rxn:smelt-malachite"));
});

test("a reaction: what goes in and out for each kilogram made, its heat and fuel, who knows it", () => {
  const p = page("rxn:bloomery");
  assert.equal(p.kind, "reaction");
  const lists = of(blocks(p), "list"),
    ins = lists.find((b) => b.title?.startsWith("What goes in"))!;
  assert.ok(ins.items.some((i) => i.ref === "subst:hematite"));
  const facts = of(blocks(p), "facts")[0]!;
  assert.ok(facts.rows.some((r) => r.label === "Heat" && String(r.value).includes("1,200")));
  assert.ok(facts.rows.some((r) => r.label === "Taught by"));
});

test("a principle: what it needs, drives and brings, the reactions it teaches, who knows it and since when", () => {
  const p = page("prin:metalworking");
  assert.equal(p.kind, "principle");
  const lands = Number(
    String(p.stats.find((s) => s.label === "Lands that know it")!.value).replace(/,/g, ""),
  );
  assert.ok(lands >= 1, `${lands} lands smelt copper by year 260`);
  const taught = of(blocks(p), "list").find((b) => b.title === "The reactions it teaches")!;
  assert.ok(taught.items.some((i) => i.ref === "rxn:smelt-malachite"));
  const who = of(blocks(p, "lands"), "list")[0]!;
  assert.ok(who.items.length >= 1 && who.items[0]!.year !== undefined, "since a year");
  assert.equal(page("prin:bronze").kind, "principle");
});

test("a good the world over: a unit's weight, what it is made of each way, how it is made, who holds it", () => {
  const p = page("good:tools");
  assert.equal(p.kind, "goods");
  assert.equal(of(blocks(p), "composition").length, 5, "stone, copper, bronze, iron, steel");
  const making = of(blocks(p, "making"), "list")[0]!;
  assert.ok(making.items.length >= 2, "stone tools and copper tools");
  const holders = of(blocks(p, "holders"), "list")[0]!;
  assert.match(holders.title ?? "", /^The world holds [\d,]+ units/);
});

test("a good in a land: what it is made of there, and how it is made there or why not", () => {
  const map = ask<{ cell: number; people: number }[]>("people.map"),
    land = [...map].sort((a, b) => b.people - a.people)[0]!,
    tools = GOODS.findIndex((g) => g.id === "tools"),
    p = page(`mkt:${land.cell}:${tools}`),
    matter = blocks(p, "matter");
  const made = of(matter, "composition")[0]!;
  assert.match(
    made.title ?? "",
    /^What it is made of here: (stone|copper|bronze|iron|steel) tools/,
  );
  assert.ok(Math.abs(made.parts.reduce((s, x) => s + x.share, 0) - 1) < 1e-9);
  const how = of(matter, "list")[0]!;
  assert.ok(how.items.every((i) => /^[✓✗] /.test(String(i.line[0]))));
  // Clothing and pottery: made of what the land can make them of, each way told.
  for (const id of ["clothing", "pottery"]) {
    const other = page(`mkt:${land.cell}:${GOODS.findIndex((g) => g.id === id)}`);
    assert.equal(other.kind, "good", `${id} is in its market`);
    const list = of(blocks(other, "matter"), "list")[0]!;
    assert.ok(list.items.length >= 1 && of(blocks(other, "matter"), "composition").length === 1);
  }
});

test("every link on matter's pages opens a page", () => {
  const map = ask<{ cell: number; people: number }[]>("people.map"),
    land = [...map].sort((a, b) => b.people - a.people)[0]!;
  const refs = new Set<string>();
  for (const ref of [
    "subst:malachite",
    "subst:bronze",
    "subst:water",
    "rxn:bloomery",
    "rxn:melt-glass",
    "prin:metalworking",
    "prin:glass",
    "good:tools",
    "good:grain",
    `mkt:${land.cell}:6`,
  ])
    for (const r of links(page(ref))) refs.add(r);
  for (const r of refs) assert.notEqual(page(r).kind, "unknown", `${r} opens a page`);
  assert.ok(refs.size > 20, `${refs.size} links followed`);
});

test("every market's every good balances, year on year: what it began with, made, brought, used, sent, spoiled, carried", () => {
  const markets = world.store<MarketStore>("economy.markets").all();
  let checked = 0;
  for (const m of markets)
    for (const y of m.years)
      GOODS.forEach((_, g) => {
        const f = flowOf(m, g, y);
        if (!f) return;
        checked++;
        assert.equal(f.out, 0, `${m.cell} ${GOODS[g]!.id} year ${y.year} is out by ${f.out}`);
      });
  assert.ok(checked > 1000, `${checked} goods' years checked`);
  // And the year so far.
  for (const m of markets) GOODS.forEach((_, g) => assert.equal(flowOf(m, g, null)!.out, 0));
});

test("a land's stores broken down: weight, worth, how long each lasts, what they are made of; a good's year as a flow", () => {
  const map = ask<{ cell: number; people: number }[]>("people.map"),
    land = [...map].sort((a, b) => b.people - a.people)[0]!,
    p = page(`cell:0:${land.cell}`),
    stores = blocks(p, "stores");
  const facts = of(stores, "facts")[0]!;
  assert.match(
    String(facts.rows.find((r) => r.label === "Its books")!.value),
    /^every good's year balances/,
  );
  assert.match(
    String(facts.rows.find((r) => r.label === "Its stores weigh")!.value),
    /\d+ (t|kg)$/,
  );
  const table = of(stores, "table")[0]!;
  assert.deepEqual(table.columns, ["Good", "Units", "Weight", "Lasts"]);
  assert.ok(table.rows.length >= 4);
  const made = of(stores, "composition")[0]!;
  assert.ok(
    made.parts.some((x) => String(x.name[0] && (x.name[0] as { text?: string }).text) === "starch"),
  );
  // A good's year: the flow balances.
  const grain = page(`mkt:${land.cell}:0`),
    flows = of(blocks(grain, "year"), "flow");
  assert.ok(flows.length >= 1 && flows.every((f) => f.balanced));
  assert.ok(flows[0]!.rows.some((r) => r.sign > 0) && flows[0]!.rows.some((r) => r.sign < 0));
});

test("a realm's stores and the world's, summed; the world's quick enough to read as a page is looked at", () => {
  const realm = politiesOf(world)
      .all()
      .find((r) => r.ended === null && r.members.length > 2)!,
    rp = page(realm.ref);
  assert.ok(of(blocks(rp, "stores"), "table")[0]!.rows.length > 0, "a realm's stores");
  const t0 = performance.now(),
    world_ = storesSummed(world, null, "The world's stores"),
    ms = performance.now() - t0;
  assert.ok(world_.length >= 3);
  assert.ok(ms < 400, `the world's stores read in ${ms.toFixed(0)} ms`);
  const stats = page("world:stats");
  assert.ok(stats.tabs.some((t) => t.id === "goods"));
});

test("the goods lens: each land's stores a head, and a land's tooltip breaks one good's year down", () => {
  const entries = ask<{ cell: number; people: number; goods: number[] }[]>("people.map");
  assert.ok(entries.every((e) => e.goods.length === 0 || e.goods.length === GOODS.length));
  const land = [...entries].sort((a, b) => b.people - a.people)[0]!,
    tip = ask<Tip>("tip", { ref: `cell:0:${land.cell}`, lens: "goods:grain" });
  assert.match(tip.line, /^Goods: grain [\d.]+ a head$/);
  assert.ok(tip.stats.some((s) => s.label === "In store"));
  assert.ok(tip.stats.some((s) => /^Made in year \d+$/.test(s.label)));
  const wool = ask<Tip>("tip", { ref: `cell:0:${land.cell}`, lens: "goods:wool" });
  assert.match(wool.line, /^Goods: wool /);
});
