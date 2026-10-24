import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { healthOf, politiesOf, populationContext, type Polity } from "../../src/sim/index.ts";
import type { Answer, Block, PageModel, Tip } from "../../src/bridge/index.ts";
import { HEALTH_CONCEPTS } from "../../src/host/inspect/health-concepts.ts";

// Phase 20 M140: sickness, read — a sickness's page, a land's health, the ledger's sicknesses,
// the lens of sickness, the book's concepts, the god's hand. The first light's world a century
// and a quarter on, a new sickness loosed on its greatest realm's most peopled land and given
// three years to travel.
const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const ctx = populationContext(world),
  people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
  realm = [...politiesOf(world).living()].sort(
    (a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1),
  )[0]!,
  land = [...realm.members].sort(
    (a, b) => (ctx.provinces.get(b)?.total() ?? 0) - (ctx.provinces.get(a)?.total() ?? 0) || a - b,
  )[0]!;
world.submit("act.loose", { cell: land, sickness: null });
world.runTo(world.now + 3);
const store = healthOf(world)!,
  sickness = store.sicknesses.find((s) => s.source === "the god")!;
world.runTo(128 * YEAR);
const page = (ref: string) => ask<PageModel>("page", { ref }),
  tabOf = (p: PageModel, id: string) => p.tabs.find((t) => t.id === id)!,
  facts = (blocks: readonly Block[]) =>
    blocks.flatMap((b) => (b.type === "facts" ? b.rows : [])).map((r) => r.label);

test("a sickness's page: its nature, its rising and why, its dead, a drop of blood under the glass, the god's hand", () => {
  const p = page(sickness.ref);
  assert.equal(p.kind, "sickness");
  assert.equal(p.title.toLowerCase(), sickness.name.toLowerCase());
  const overview = tabOf(p, "overview"),
    labels = facts(overview.blocks);
  for (const l of [
    "It passes",
    "Of those it reaches",
    "Of those who take it",
    "The survivors",
    "It rose",
    "Lands it came to",
    "Its dead",
  ])
    assert.ok(labels.includes(l), `${l} told`);
  const rose = overview.blocks
    .flatMap((b) => (b.type === "facts" ? b.rows : []))
    .find((r) => r.label === "It rose")!;
  assert.equal(rose.why, sickness.event);
  const drop = overview.blocks.find((b) => b.type === "drop");
  assert.ok(drop && drop.type === "drop" && drop.kinds.some((k) => k.ref === sickness.ref));
  const tool = overview.blocks.find((b) => b.type === "tool" && b.tool === "acts.sickness");
  assert.ok(tool && tool.type === "tool" && tool.args.sickness === sickness.ref);
  const comings = tabOf(p, "comings").blocks.find((b) => b.type === "list");
  assert.ok(comings && comings.type === "list" && comings.items.length >= 1);
  assert.ok(comings.items.every((i) => i.ref?.startsWith("ev:")));
});

test("a land's health: what came and what it took, who is spared, its healers; the god's ward offered", () => {
  const health = tabOf(page(`cell:0:${land}`), "health");
  assert.ok(health, "a health tab");
  const labels = facts(health.blocks);
  for (const l of ["Last came", "It took", "Its healers", "Drains and clean water"])
    assert.ok(labels.includes(l), `${l} told`);
  assert.ok(
    labels.some((l) => l.startsWith("Spared ")),
    "who is spared",
  );
  const rows = health.blocks.flatMap((b) => (b.type === "facts" ? b.rows : []));
  assert.ok(
    rows.every((r) => r.concept),
    "each a measure of a concept",
  );
  const last = rows.find((r) => r.label === "Last came")!;
  assert.equal(world.events.get(last.why as Ref)?.type, "health.outbreak");
  const tool = health.blocks.find((b) => b.type === "tool" && b.tool === "acts.health");
  assert.ok(tool && tool.type === "tool" && tool.args.cell === land);
  assert.ok((tool.args.sicknesses as unknown[]).length >= 1);
});

test("the ledger sets every sickness side by side; the lens of sickness reads a land; the chronicle tells the first", () => {
  const ledger = tabOf(page("world:ledger"), "sickness");
  assert.ok(ledger, "a sickness tab");
  const table = ledger.blocks.find((b) => b.type === "table" && b.title === "Every sickness");
  assert.ok(table && table.type === "table" && table.rows.some((r) => r.ref === sickness.ref));
  const bars = ledger.blocks.find((b) => b.type === "bars");
  assert.ok(bars && bars.type === "bars" && bars.bars.some((x) => x.ref === sickness.ref));
  const entry = ask<{ cell: number; sickness: number }[]>("people.map").find(
    (e) => e.cell === land,
  )!;
  assert.ok(entry.sickness >= 0 && entry.sickness <= 1, `sickness ${entry.sickness}`);
  const tip = ask<Tip>("tip", { ref: `cell:0:${land}`, lens: "sickness" });
  assert.match(tip.line, /^🦠 Sickness: /);
  assert.ok(tip.stats.some((s) => s.label === "Its healers"));
  const firsts = tabOf(page("world:chronicle"), "firsts").blocks.find((b) => b.type === "table");
  assert.ok(firsts && firsts.type === "table");
  assert.ok(
    firsts.rows.some((r) => JSON.stringify(r.cells[0]).includes("A new sickness")),
    "the first sickness",
  );
});

test("the book of concepts has a page for each of sickness's concepts, each bound up with pages it has", () => {
  for (const [id, c] of Object.entries(HEALTH_CONCEPTS)) {
    const p = page(`concept:${id}`);
    assert.equal(p.title, c.title, id);
    const related = p.tabs[0]!.blocks.find((b) => b.type === "list" && b.title === "Bound up with");
    assert.ok(related && related.type === "list" && related.items.length >= 2, `${id} bound up`);
    for (const i of related.items)
      assert.notEqual(page(i.ref!).title, "The book of concepts", `${id}: ${i.ref} has a page`);
  }
});

test("the god may answer a sickness come: the land warded; the ward told and titled", () => {
  const coming = world.events
      .all()
      .find((e) => e.type === "health.outbreak" && e.place === `cell:0:${land}`)!,
    answers = ask<Answer[]>("event.answers", { ref: coming.id, watch: realm.ref });
  assert.ok(
    answers.some((a) => a.act === "act.ward" && (a.args as { cell: number }).cell === land),
  );
  world.submit("act.ward", { cell: land });
  world.runTo(world.now + 3);
  const ward = world.events.all().findLast((e) => e.type === "act.ward")!;
  assert.equal(page(ward.id).title, "A land warded");
  assert.equal(page(coming.id).title, "A sickness came");
  assert.ok(facts(tabOf(page(`cell:0:${land}`), "health").blocks).includes("Warded by the god"));
});
