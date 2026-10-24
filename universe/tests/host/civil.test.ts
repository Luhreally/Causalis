import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type SimTime } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  STRIFE_ACTS,
  breakAway,
  farLands,
  orderOf,
  politiesOf,
  populationContext,
  realmName,
  revolt,
  settleCivil,
  strifeOf,
  warsOf,
  type Polity,
} from "../../src/sim/index.ts";
import type { Block, PageModel } from "../../src/bridge/index.ts";

// Phase 22 M146: civil wars and revolutions, read — a civil war's kind and end on its war's page,
// a realm's civil wars and how near its people are to rising, the ledger's tables, the chronicle's
// firsts. The first light's world a century and a quarter on; a pretender raised by hand in its
// greatest realm's far lands, and its people risen in the next.
const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const ctx = populationContext(world),
  people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
  byPeople = [...politiesOf(world).living()].sort(
    (a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1),
  ),
  realm = byPeople.find((p) => farLands(ctx, p).length)!,
  // (Not a commonwealth already: its people have no court to overthrow.)
  other = byPeople.find((p) => p !== realm && p.leadership !== 2)!,
  at = (k: number) => (world.now + k) as SimTime;
const page = (ref: string) => ask<PageModel>("page", { ref }),
  tabOf = (p: PageModel, id: string) => p.tabs.find((t) => t.id === id)!,
  rowsOf = (blocks: readonly Block[]) => blocks.flatMap((b) => (b.type === "facts" ? b.rows : []));

test("the god's hand on a realm's far lands: a pretender's tool names where it would rise", () => {
  const tool = tabOf(page(realm.ref), "strife").blocks.find(
    (b) => b.type === "tool" && b.tool === "acts.strife",
  );
  assert.ok(tool && tool.type === "tool");
  assert.equal(typeof tool.args.far, "number", "a far land to raise a pretender in");
  assert.ok(farLands(ctx, realm).includes(tool.args.far as number));
  assert.equal(typeof tool.args.farName, "string");
});

test("a civil war: titled a rising, its kind and end on its page; the realm's page, the ledger and the chronicle tell it", () => {
  const cause = world.events.emit({
      type: STRIFE_ACTS.pretender.type,
      subjects: [realm.ref],
      place: null,
      data: { realm: realmName(realm) },
    }),
    rebel = breakAway(ctx, realm, farLands(ctx, realm), cause, "pretender", at(1))!,
    c = strifeOf(world)!.civil.at(-1)!,
    w = warsOf(world).get(c.war)!;
  assert.ok(rebel);
  let p = page(w.ref);
  assert.match(p.title, /^The rising of .* against /);
  let rows = rowsOf(tabOf(p, "overview").blocks);
  const kind = rows.find((r) => r.label === "A civil war")!;
  assert.match(String(kind.value), /a pretender's claim/);
  assert.equal(kind.concept, "civil-war");
  assert.ok(!rows.some((r) => r.label === "It came to"), "not yet come to anything");
  settleCivil(ctx, w, false, true, at(2));
  p = page(w.ref);
  rows = rowsOf(tabOf(p, "overview").blocks);
  const end = rows.find((r) => r.label === "It came to")!;
  assert.match(String(end.value), /the rising put down|the realm left parted/);
  assert.equal(end.why, c.settled);

  const strife = tabOf(page(realm.ref), "strife"),
    civil = rowsOf(strife.blocks).find((r) => r.label === "Civil wars")!;
  assert.equal(String(civil.value), "1");
  const list = strife.blocks.find(
    (b) => b.type === "list" && b.title === "Its civil wars, the newest first",
  );
  assert.ok(list && list.type === "list" && list.items.some((i) => i.ref === w.ref));
  const ledger = tabOf(page("world:ledger"), "strife"),
    table = ledger.blocks.find(
      (b) => b.type === "table" && b.title === "Every civil war, the newest first",
    );
  assert.ok(table && table.type === "table" && table.rows.some((r) => r.ref === w.ref));
  const firsts = tabOf(page("world:chronicle"), "firsts").blocks.find((b) => b.type === "table");
  assert.ok(firsts && firsts.type === "table");
  assert.ok(
    firsts.rows.some((r) => JSON.stringify(r.cells[0]).includes("A civil war")),
    "the first civil war",
  );
  assert.match(page(c.settled!).title, /A rising put down|A realm parted/);
});

test("a revolution: how near its people are, and why; won, the realm's page, the ledger and the chronicle tell it", () => {
  const o = orderOf(world)!.of(other.ref)!;
  o.movements.push({ cause: "voice", strength: 0.6, since: 120, event: other.event });
  o.legitimacy = 0.2;
  let rows = rowsOf(tabOf(page(other.ref), "strife").blocks);
  const near = rows.find((r) => r.label === "A revolution")!;
  assert.ok(near, "how near its people are to rising");
  assert.equal(near.concept, "revolution");
  assert.match(JSON.stringify(near.parts), /a people who want a voice/);
  assert.match(JSON.stringify(near.parts), /a rule doubted/);
  const event = revolt(ctx, other, "voice", [], at(3));
  const p = page(other.ref);
  assert.match(p.title, /^The commonwealth of /);
  rows = rowsOf(tabOf(p, "strife").blocks);
  assert.ok(rows.some((r) => r.label === "Revolutions" && r.why === event));
  assert.ok(!rows.some((r) => r.label === "A revolution"), "none weighed in a commonwealth");
  const ledger = tabOf(page("world:ledger"), "strife"),
    list = ledger.blocks.find(
      (b) => b.type === "list" && b.title === "Revolutions, the newest first",
    );
  assert.ok(list && list.type === "list" && list.items.some((i) => i.why === event));
  const firsts = tabOf(page("world:chronicle"), "firsts").blocks.find((b) => b.type === "table");
  assert.ok(
    firsts &&
      firsts.type === "table" &&
      firsts.rows.some((r) => JSON.stringify(r.cells[0]).includes("A revolution")),
    "the first revolution",
  );
  assert.equal(page(event).title, "A revolution");
});
