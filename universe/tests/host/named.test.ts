// Those the world keeps by name, as the game shows them (host/inspect/notables.ts over sim/notable): each has a page told from
// what they did, is one of their town's key figures, holds its office where the world keeps one for it, can be acted on by the
// god, and reads as dead once they are. Juniper a hundred and twenty years on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR } from "../../src/kernel/index.ts";
import {
  commandIn,
  firstField,
  notablesOf,
  politiesOf,
  populationContext,
} from "../../src/sim/index.ts";
import {
  forgetNotables,
  goneNamed,
  namedRef,
  notableOf,
  notablePeopleBlock,
  notablesIn,
} from "../../src/host/inspect/notables.ts";
import { fateOf } from "../../src/host/inspect/barread.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { godActsFor } from "../../src/host/death.ts";
import { leadersOfTown, seatTownOf } from "../../src/host/leaders.ts";
import { why } from "../../src/causal/index.ts";
import { personsOfNote } from "../../src/host/persons.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("juniper", 120, { start: "spread" }),
  ctx = populationContext(world),
  store = notablesOf(world)!;

const text = (page: ReturnType<typeof pageOf>): string =>
  JSON.stringify(page.tabs.flatMap((t) => t.blocks));

test("one the world keeps has a page told from what they did, and is a key figure of their land's first town", () => {
  const met = store
    .all()
    .map((n) => ({ n, host: notableOf(world, namedRef(n.id)) }))
    .filter((x) => x.host !== null);
  assert.ok(met.length >= 3, `${met.length} of ${store.count} can be met in a town`);
  for (const { n, host } of met.slice(0, 12)) {
    const ref = namedRef(n.id),
      page = pageOf(world, ref),
      body = text(page);
    assert.equal(page.title, n.name);
    assert.equal(page.kind, "person");
    assert.match(body, /Among their people/);
    assert.match(body, /What they did/);
    assert.ok(body.includes("times what it takes to be known by name"));
    assert.equal(fateOf(world, ref, page), null, "living");
    // (One body in their town, with the hand's way to them, unless they are away with a host.)
    const here = leadersOfTown(world, host!.town).filter((l) => l.ref === ref);
    assert.equal(here.length, 1, `${n.name} in ${host!.townName}`);
    if (!host!.away) assert.ok(here[0]!.as, "to be lived as");
    const acts = godActsFor(world, ref)!;
    assert.equal(acts.kind, "notable");
    assert.deepEqual(
      acts.acts.map((a) => a.kind),
      ["bless", "curse", "protect", "smite", "inspire"],
    );
  }
  // (Every living one has a page, a town to meet them in or not.)
  for (const n of store.all()) assert.equal(pageOf(world, namedRef(n.id)).title, n.name);
});

test("the commander the war asks for is the commander their realm's seat shows; a land's notable of the law is its judge", () => {
  const r = politiesOf(world)
    .living()
    .find((p) => seatTownOf(world, p))!;
  const led = commandIn(ctx, r, world.now)!;
  forgetNotables(world);
  const seat = seatTownOf(world, r)!,
    general = notablesIn(world, seat.ref).find((n) => n.kind === "general")!;
  assert.equal(general.ref, namedRef(led.id));
  assert.equal(general.name, led.name);
  assert.match(general.title, /^Commander of the host of/);
  assert.equal(general.sim?.id, led.id);
  // (No office is held twice over, and no one of name holds two.)
  for (const s of ctx.settlements.all().filter((t) => t.population > 0)) {
    const at = notablesIn(world, s.ref),
      refs = at.map((n) => n.ref);
    assert.equal(new Set(refs).size, refs.length, s.name);
    for (const k of ["judge", "priest", "general", "merchant"] as const)
      assert.ok(at.filter((n) => n.kind === k).length <= 1, `${s.name}: two of ${k}`);
    const judge = at.find((n) => n.kind === "judge");
    if (judge?.sim) assert.equal(firstField(judge.sim), 7, "of the law");
  }
});

test("a land's and a realm's pages list their notable people; a rising is told with its causes", () => {
  const n = store.all().sort((a, b) => b.standing - a.standing)[0]!,
    block = notablePeopleBlock(world, [n.home])!;
  assert.equal(block.type, "list");
  assert.ok(JSON.stringify(block).includes(n.name));
  const land = pageOf(world, ctx.provinces.get(n.home)!.ref);
  assert.ok(text(land).includes("Its notable people"));
  const realm = politiesOf(world).of(n.home);
  if (realm) assert.ok(text(pageOf(world, realm.ref)).includes(n.name));
  const told = world.events.all().filter((e) => e.type === "notable.arose");
  for (const e of told.slice(-4)) assert.match(why(world, e.id).claim, /came to be known: /);
});

test("the god's hand reaches one of name: blessed, then struck down, and from then they read as dead", () => {
  const n = store
      .all()
      .filter((x) => !x.post && notableOf(world, namedRef(x.id)))
      .sort((a, b) => b.standing - a.standing)[0]!,
    ref = namedRef(n.id),
    year = Math.floor(world.now / YEAR),
    before = n.standing;
  world.submit("act.person", { ref, kind: "bless", name: n.name });
  world.runTo(world.now + 1);
  assert.equal(store.get(n.id)!.favour!.kind, "bless");
  assert.ok(store.get(n.id)!.standing > before);
  world.submit("act.person", { ref, kind: "smite", name: n.name });
  world.runTo(world.now + 1);
  assert.equal(store.get(n.id), undefined);
  const gone = goneNamed(world, ref)!;
  assert.equal(gone.how, "struck");
  assert.equal(gone.died, year);
  forgetNotables(world);
  const page = pageOf(world, ref),
    fate = fateOf(world, ref, page)!;
  assert.equal(page.title, n.name);
  assert.ok(fate.dead);
  assert.match(fate.words, /struck down/);
  assert.equal(godActsFor(world, ref), null, "no act reaches the dead");
});

test("everyone the world keeps by name is read one way: rulers, courts, heads, envoys and those known for a deed, each once", () => {
  const all = personsOfNote(world),
    by = (k: string) => all.filter((p) => p.kept === k);
  assert.equal(by("ruler").length, politiesOf(world).living().length);
  assert.ok(by("named").length >= 3);
  const refs = all.map((p) => p.ref);
  assert.equal(new Set(refs).size, refs.length, "no one twice");
  for (const p of by("named")) {
    assert.ok(p.standing! > 0 && p.domain);
    // (One of name who is of a court is given as the notable, the court's ref beside, and not again as the court's.)
    if (p.also) assert.ok(!refs.includes(p.also), `${p.name} twice`);
  }
  for (const p of all.slice(0, 40)) assert.ok(p.name && p.title, p.ref);
});
