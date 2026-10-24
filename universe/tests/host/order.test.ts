import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  LAWS,
  LAW_OF,
  LAW_POSITIONS,
  ORDER_EVENTS,
  orderOf,
  politiesOf,
  populationContext,
  type Polity,
} from "../../src/sim/index.ts";
import type { Answer, Block, PageModel, Tip } from "../../src/bridge/index.ts";
import { ORDER_CONCEPTS } from "../../src/host/inspect/order-concepts.ts";

// Phase 19 M138: bonds and freedoms, read — a realm's order on its page, a land's bound, the
// ledger's bonds, the lenses of bondage and of standing, the book's concepts, the god's acts.
// The first light's world a century and a quarter on, the bound set in its greatest realm.
const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const ctx = populationContext(world),
  people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
  realm = [...politiesOf(world).living()].sort(
    (a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1),
  )[0]!,
  store = orderOf(world)!,
  lands = [...realm.members]
    .sort((a, b) => (ctx.provinces.get(b)?.total() ?? 0) - (ctx.provinces.get(a)?.total() ?? 0))
    .slice(0, 3);
// Its most peopled lands: a fifth of their people chattel, a tenth serfs, bound to the land.
const bound = world.events.emit({
  type: ORDER_EVENTS.serfdom.type,
  subjects: [realm.ref],
  place: ctx.provinces.get(realm.seat)!.ref,
  causes: [{ ref: realm.event, role: "enabler", weight: 1 }],
  data: { realm: "it", share: 10 },
});
for (const c of lands) store.lands.set(c, { cell: c, shares: [0.2, 0, 0.1, 0, 0], cause: bound });
const page = (ref: string) => ask<PageModel>("page", { ref }),
  tabOf = (p: PageModel, id: string) => p.tabs.find((t) => t.id === id)!,
  facts = (blocks: readonly Block[]) =>
    blocks.flatMap((b) => (b.type === "facts" ? b.rows : [])).map((r) => r.label);

test("a realm's order, a tab of its page: its standing and what makes it, its reach, rank and levies, who is held", () => {
  const order = tabOf(page(realm.ref), "order");
  assert.ok(order, "an order tab");
  const labels = facts(order.blocks);
  for (const l of [
    "Standing",
    "Reach",
    "Skimmed",
    "Rank",
    "Corvée",
    "Held in bondage",
    "Law of bondage",
  ])
    assert.ok(labels.includes(l), `${l} told`);
  const rows = order.blocks.flatMap((b) => (b.type === "facts" ? b.rows : []));
  assert.ok(
    rows.every((r) => r.concept),
    "each a measure of a concept",
  );
  assert.ok(rows.find((r) => r.label === "Standing")!.parts!.length >= 3, "what makes it");
  const who = order.blocks.find((b) => b.type === "composition")!;
  assert.ok(who && who.type === "composition");
  const shares = who.parts.reduce((s, x) => s + x.share, 0);
  assert.ok(Math.abs(shares - 1) < 0.01, `the shares make the whole: ${shares}`);
  assert.ok(who.parts.length >= 3, "the free, the chattel and the serfs");
  const where = order.blocks.find((b) => b.type === "table" && b.title === "Where they are held");
  assert.ok(where && where.type === "table" && where.rows.length >= lands.length);
  const tool = order.blocks.find((b) => b.type === "tool" && b.tool === "acts.order");
  assert.ok(tool && tool.type === "tool" && (tool.args.bound as number) > 0 && tool.args.stirrable);
});

test("a land's page tells its bound and its realm's law; the map's lenses read its bondage and standing", () => {
  const land = page(`cell:0:${lands[0]}`),
    blocks = tabOf(land, "realm").blocks;
  assert.ok(blocks.some((b) => b.type === "facts" && b.title === "Bonds and freedoms"));
  assert.ok(facts(blocks).includes("Held in bondage") && facts(blocks).includes("Its realm's law"));
  const entry = ask<{ cell: number; bondage: number; standing: number }[]>("people.map").find(
    (e) => e.cell === lands[0],
  )!;
  assert.ok(Math.abs(entry.bondage - 0.3) < 0.001, `bondage ${entry.bondage}`);
  assert.ok(entry.standing >= 0 && entry.standing <= 1, `standing ${entry.standing}`);
  const ref = `cell:0:${lands[0]}`,
    held = ask<Tip>("tip", { ref, lens: "bondage" });
  assert.match(held.line, /^Bondage: 30% of its people held/);
  assert.ok(
    held.stats.some((s) => /Chattel/.test(s.label)) &&
      held.stats.some((s) => /Serfs/.test(s.label)),
  );
  const standing = ask<Tip>("tip", { ref, lens: "standing" });
  assert.match(standing.line, /^Standing: .* \(\d+%\)$/);
  assert.ok(standing.stats.length >= 3, "what makes it");
});

test("the ledger sets every realm's order side by side, and the chronicle tells the first held", () => {
  const bonds = tabOf(page("world:ledger"), "bonds");
  assert.ok(bonds, "a bonds tab");
  const bars = bonds.blocks.find((b) => b.type === "bars");
  assert.ok(bars && bars.type === "bars" && bars.bars.some((x) => x.ref === realm.ref));
  const table = bonds.blocks.find((b) => b.type === "table");
  assert.ok(table && table.type === "table" && table.rows.some((r) => r.ref === realm.ref));
  const firsts = tabOf(page("world:chronicle"), "firsts").blocks.find((b) => b.type === "table");
  assert.ok(firsts && firsts.type === "table");
  assert.ok(
    firsts.rows.some((r) => JSON.stringify(r.cells[0]).includes("People held in bondage")),
    "the first held",
  );
});

test("the book of concepts has a page for each of bonds and freedoms, each bound up with pages it has", () => {
  for (const [id, c] of Object.entries(ORDER_CONCEPTS)) {
    const p = page(`concept:${id}`);
    assert.equal(p.title, c.title, id);
    const related = p.tabs[0]!.blocks.find((b) => b.type === "list" && b.title === "Bound up with");
    assert.ok(related && related.type === "list" && related.items.length >= 2, `${id} bound up`);
    for (const i of related.items)
      assert.notEqual(page(i.ref!).title, "The book of concepts", `${id}: ${i.ref} has a page`);
  }
});

test("the god may answer a realm's crisis of standing: its chains broken, or a sign for or against its rule", () => {
  const crisis = world.events.emit({
      type: ORDER_EVENTS.crisis.type,
      subjects: [realm.ref],
      place: ctx.provinces.get(realm.seat)!.ref,
      causes: [{ ref: realm.event, role: "enabler", weight: 1 }],
      data: { realm: "it" },
    }),
    answers = ask<Answer[]>("event.answers", { ref: crisis, watch: realm.ref });
  assert.deepEqual(
    answers.map((a) => [a.act, (a.args as { sign?: number }).sign ?? null]),
    [
      ["act.unchain", null],
      ["act.mandate", 1],
      ["act.mandate", -1],
    ],
  );
  for (const a of answers) assert.ok(a.label.includes(realm.town), a.label);
});

test("the god's sign against a realm's rule is told, titled and weighed on its page", () => {
  world.submit("act.mandate", { realm: realm.ref, sign: -1 });
  world.runTo(world.now + 3);
  const sign = world.events.all().findLast((e) => e.type === "act.mandate")!;
  assert.equal(page(sign.id).title, "A sign from the heavens");
  assert.equal(page(bound).title, "Bound to the land");
  const order = tabOf(page(realm.ref), "order"),
    standing = order.blocks
      .flatMap((b) => (b.type === "facts" ? b.rows : []))
      .find((r) => r.label === "Standing")!;
  assert.ok(
    standing.parts!.some((x) => JSON.stringify(x.label).includes("against its rule")),
    "the sign among what makes it",
  );
  assert.ok(facts(order.blocks).includes("A sign from the heavens"));
});

test("a realm's laws on its page, each where it stands and what made it so; the lens of laws; the ledger's laws", () => {
  const o = store.of(realm.ref)!,
    order = tabOf(page(realm.ref), "order"),
    laws = order.blocks.find((b) => b.type === "facts" && b.title === "Its laws");
  assert.ok(laws && laws.type === "facts");
  assert.deepEqual(
    laws.rows.map((r) => r.label),
    ["🌾 The land", "🧳 Strangers", "🙏 Other faiths", "⚖️ Justice", "Its powerful"],
  );
  assert.ok(laws.rows.every((r) => r.concept === "laws"));
  LAWS.forEach((law, k) => {
    assert.deepEqual(laws.rows[k]!.value, [LAW_POSITIONS[law][o.laws[k]!]]);
    assert.equal(laws.rows[k]!.why ?? null, o.lawEvents[k] ?? null);
  });
  const tool = order.blocks.find((b) => b.type === "tool" && b.tool === "acts.laws");
  assert.ok(tool && tool.type === "tool" && tool.args.realm === realm.ref);
  assert.equal((tool.args.laws as unknown[]).length, LAWS.length);
  // The map's lens of laws, one law at a time.
  const entry = ask<{ cell: number; laws: number[] }[]>("people.map").find(
    (e) => e.cell === lands[0],
  )!;
  assert.deepEqual(entry.laws, o.laws);
  const ref = `cell:0:${lands[0]}`,
    faith = ask<Tip>("tip", { ref, lens: "laws:faith" }),
    land = ask<Tip>("tip", { ref, lens: "laws" });
  assert.match(faith.line, /^🙏 Other faiths: (one faith|others tolerated|free conscience) — /);
  assert.match(land.line, /^🌾 The land: (the lord's|leased|the tiller's own) — /);
  assert.ok(faith.stats.some((s) => s.label === "Its powerful"));
  // The ledger: every realm's laws side by side.
  const table = tabOf(page("world:ledger"), "bonds").blocks.find(
    (b) => b.type === "table" && b.title === "Each realm's laws",
  );
  assert.ok(table && table.type === "table");
  assert.ok(table.rows.some((r) => r.ref === `${realm.ref}#order`));
  assert.ok(table.rows.length >= politiesOf(world).living().length / 2);
});

test("the god's decree of a realm's law: told, titled, shown on its page, and first in the chronicle", () => {
  const o = store.of(realm.ref)!,
    to = o.laws[LAW_OF.justice] === 2 ? 1 : 2;
  world.submit("act.decree", { realm: realm.ref, law: "justice", to });
  world.runTo(world.now + 3);
  const decree = world.events.all().findLast((e) => e.type === "act.decree")!;
  assert.equal(page(decree.id).title, "A law decreed");
  const laws = tabOf(page(realm.ref), "order").blocks.find(
    (b) => b.type === "facts" && b.title === "Its laws",
  );
  assert.ok(laws && laws.type === "facts");
  const justice = laws.rows.find((r) => r.label === "⚖️ Justice")!;
  assert.deepEqual(justice.value, [LAW_POSITIONS.justice[to]]);
  assert.equal(justice.why, decree.id, "the decree behind it");
  if (to === 2) {
    const firsts = tabOf(page("world:chronicle"), "firsts").blocks.find((b) => b.type === "table");
    assert.ok(firsts && firsts.type === "table");
    assert.ok(
      firsts.rows.some((r) => JSON.stringify(r.cells[0]).includes("One law for all")),
      "one law for all, first",
    );
  }
});
