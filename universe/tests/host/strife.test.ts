import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type SimTime } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  foil,
  politiesOf,
  populationContext,
  restore,
  seize,
  strifeOf,
  type Polity,
} from "../../src/sim/index.ts";
import type { Block, PageModel } from "../../src/bridge/index.ts";
import { STRIFE_CONCEPTS } from "../../src/host/inspect/strife-concepts.ts";

// Phase 22 M145: strife, read — a realm's army and how near a coup is, its rule by its army, the
// ledger's coups, the chronicle's first, the book's concepts. The first light's world a century
// and a quarter on; its greatest realm's seat seized by hand, given back, and a coup foiled in the
// next greatest.
const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const ctx = populationContext(world),
  people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
  [realm, other] = [...politiesOf(world).living()]
    .filter((p) => p.members.length >= 2)
    .sort((a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1)) as [Polity, Polity],
  at = (k: number) => (world.now + k) as SimTime;
const page = (ref: string) => ask<PageModel>("page", { ref }),
  tabOf = (p: PageModel, id: string) => p.tabs.find((t) => t.id === id)!,
  rowsOf = (blocks: readonly Block[]) => blocks.flatMap((b) => (b.type === "facts" ? b.rows : []));

test("a realm's strife: its army under arms and its sway, how near a coup is and why, its rule, the god's hand", () => {
  const strife = tabOf(page(realm.ref), "strife");
  assert.ok(strife, "a strife tab");
  const rows = rowsOf(strife.blocks),
    labels = rows.map((r) => r.label);
  for (const l of ["Under arms", "Its army's sway", "A coup", "Rule"])
    assert.ok(labels.includes(l), `${l} told`);
  assert.ok(
    rows.every((r) => r.concept),
    "each a measure of a concept",
  );
  const coup = rows.find((r) => r.label === "A coup")!;
  assert.ok(coup.parts && coup.parts.length >= 3, "a coup's danger broken down");
  assert.match(JSON.stringify(coup.parts), /a rule doubted|the army's sway/);
  assert.equal(String(rows.find((r) => r.label === "Rule")!.value), "its own");
  const tool = strife.blocks.find((b) => b.type === "tool" && b.tool === "acts.strife");
  assert.ok(tool && tool.type === "tool" && tool.args.cell === realm.seat);
  assert.equal(tool.args.junta, false);
});

test("a coup won: the realm a protectorate, its rule its army's; the ledger, the chronicle and the history tell it", () => {
  const event = seize(ctx, realm, [], at(1));
  const p = page(realm.ref);
  assert.match(p.title, /^The protectorate of /);
  const strife = tabOf(p, "strife"),
    rows = rowsOf(strife.blocks),
    rule = rows.find((r) => r.label === "Rule")!;
  assert.match(String(rule.value), /^its army's, since year /);
  assert.equal(rule.why, event);
  assert.ok(rows.some((r) => r.label === "Coups" && r.why === event));
  const tool = strife.blocks.find((b) => b.type === "tool" && b.tool === "acts.strife");
  assert.ok(tool && tool.type === "tool" && tool.args.junta === true);
  const list = strife.blocks.find(
    (b) => b.type === "list" && b.title === "Coups, revolutions and restorations, the newest first",
  );
  assert.ok(list && list.type === "list" && list.items.some((i) => i.why === event));
  foil(ctx, other, [], at(2));
  const ledger = tabOf(page("world:ledger"), "strife");
  assert.ok(ledger, "a strife tab in the ledger");
  const table = ledger.blocks.find(
    (b) => b.type === "table" && b.title === "Every coup, the newest first",
  );
  assert.ok(table && table.type === "table" && table.rows.length >= 2);
  assert.ok(table.rows.some((r) => r.ref === event));
  const ruled = ledger.blocks.find(
    (b) => b.type === "list" && b.title === "Realms ruled by their armies now",
  );
  assert.ok(ruled && ruled.type === "list" && ruled.items.some((i) => i.ref === realm.ref));
  const firsts = tabOf(page("world:chronicle"), "firsts").blocks.find((b) => b.type === "table");
  assert.ok(firsts && firsts.type === "table");
  assert.ok(
    firsts.rows.some((r) => JSON.stringify(r.cells[0]).includes("A coup")),
    "the first coup",
  );
  assert.equal(page(event).title, "A coup");
  assert.equal(page(strifeOf(world)!.coups.at(-1)!.event).title, "A coup foiled");
});

test("rule given back: told on the realm's page, in the ledger and its title", () => {
  const event = restore(ctx, realm, [], at(3))!;
  assert.ok(event);
  const rows = rowsOf(tabOf(page(realm.ref), "strife").blocks),
    rule = rows.find((r) => r.label === "Rule")!;
  assert.match(String(rule.value), /^its own, given back in year /);
  assert.equal(rule.why, event);
  const ledger = tabOf(page("world:ledger"), "strife"),
    back = ledger.blocks.find(
      (b) => b.type === "list" && b.title === "Rule restored, the newest first",
    );
  assert.ok(back && back.type === "list" && back.items.some((i) => i.why === event));
  assert.equal(page(event).title, "Rule restored");
});

test("the book of concepts has a page for each of strife's concepts, each bound up with pages it has", () => {
  for (const [id, c] of Object.entries(STRIFE_CONCEPTS)) {
    const p = page(`concept:${id}`);
    assert.equal(p.title, c.title, id);
    const related = p.tabs[0]!.blocks.find((b) => b.type === "list" && b.title === "Bound up with");
    assert.ok(related && related.type === "list" && related.items.length >= 2, `${id} bound up`);
    for (const i of related.items)
      assert.notEqual(page(i.ref!).title, "The book of concepts", `${id}: ${i.ref} has a page`);
  }
});
