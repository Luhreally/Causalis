import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { handOf, languagesOf, politiesOf, populationContext } from "../../src/sim/index.ts";
import type { ActsMap, Block, PageModel, Tip } from "../../src/bridge/index.ts";

// Phase 14: people as individuals (families, traits), peoples read, the god as they name it.
// The first light's world, its most peopled land's first town under the hand for twenty years.
const world = EARTH.build(seedFromText("first light"));
world.runTo(260 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const page = (ref: string) => ask<PageModel>("page", { ref });
const map = ask<{ cell: number; people: number }[]>("people.map"),
  land = [...map].sort((a, b) => b.people - a.people)[0]!,
  town = populationContext(world).settlements.inProvince(land.cell)[0]!;
world.submit("hand.lay", { village: town.ref });
world.runTo(280 * YEAR);
const blocks = (p: PageModel, tab: string) => p.tabs.find((t) => t.id === tab)?.blocks ?? [];
const of = <K extends Block["type"]>(list: readonly Block[], type: K) =>
  list.filter((b): b is Extract<Block, { type: K }> => b.type === type);

test("one of the people under the hand: their traits as chips, their family as a tree", () => {
  const w = handOf(world).resting!,
    // (Someone born under the hand, with a mother and father, and traits.)
    child = w.agents.find(
      (a) => a.birthYear > 260 && a.father !== undefined && (a.traits?.length ?? 0) > 0,
    )!;
  assert.ok(child, "one born under the hand to known parents");
  const p = page(`agent:${child.id}`),
    chips = of(blocks(p, "overview"), "chips")[0]!;
  assert.ok(chips && chips.chips.length === child.traits!.length, "each trait a chip");
  assert.ok(chips.chips.every((c) => c.ref?.startsWith("trait:")));
  const tree = of(blocks(p, "family"), "tree")[0]!;
  assert.ok(tree, "a family tree");
  const labels = tree.rows.map((r) => r.label);
  assert.ok(labels.includes("Parents"), labels.join(", "));
  assert.equal(tree.rows.find((r) => r.label === "Parents")!.people.length, 2);
  assert.ok(
    tree.rows.some((r) => r.people.some((x) => x.self)),
    "them in it",
  );
  // Their mother's tree has them among her children.
  const mother = page(`agent:${child.mother}`),
    kids = of(blocks(mother, "family"), "tree")[0]!.rows.find((r) => r.label === "Children");
  assert.ok(kids && kids.people.length >= 1);
  // A trait's page: what it does, who is so.
  const t = child.traits![0]!,
    tp = page(`trait:${t}`);
  assert.equal(tp.kind, "trait");
  const who = of(blocks(tp, "overview"), "list")[0]!;
  assert.ok(
    who.items.some((i) =>
      i.line.some((s) => typeof s !== "string" && s.ref === `agent:${child.id}`),
    ),
  );
});

test("a tongue heard and its people read: sounds, words, the god as they name it, their ways", () => {
  const l = languagesOf(world).of(land.cell)!,
    p = page(l.ref),
    speech = blocks(p, "speech"),
    people = blocks(p, "people");
  const sounds = of(speech, "facts")[0]!;
  assert.ok(sounds.rows.some((r) => r.label === "Its vowels"));
  assert.ok(of(speech, "facts")[1]!.rows.some((r) => r.label === "Places"));
  const god = of(people, "facts")[0]!;
  assert.equal(god.title, "The god, as they name it");
  const ways = of(people, "bars")[0]!;
  assert.equal(ways.bars.length, 8, "their eight ways");
  // A realm names its faith and its tongue.
  const realm = politiesOf(world).of(land.cell);
  if (realm) {
    const facts = of(blocks(page(realm.ref), "overview"), "facts")[0]!;
    assert.ok(facts.rows.some((r) => r.label === "Faith"));
    assert.ok(facts.rows.some((r) => r.label === "Tongue"));
  }
});

test("the ways and the belief on the map: each land's, and its tooltip's breakdown", () => {
  const entries = ask<{ cell: number; ways: number[]; belief: number[] }[]>("people.map");
  assert.ok(entries.every((e) => e.ways.length === 0 || e.ways.length === 8));
  assert.ok(entries.every((e) => e.belief.length === 3));
  // The hand laid among them is a portent; rain sent, a favour.
  const before = entries.find((e) => e.cell === land.cell)!;
  assert.deepEqual(before.belief, [0, 0, 1], "the hand laid among them");
  world.submit("act.rain", { cell: land.cell, sign: 1, years: 1 });
  world.runTo(world.now + 86_400);
  const after = ask<{ cell: number; belief: number[] }[]>("people.map").find(
    (e) => e.cell === land.cell,
  )!;
  assert.ok(after.belief[0]! >= 1, "favour seen");
  const ref = `cell:0:${land.cell}`;
  assert.match(ask<Tip>("tip", { ref, lens: "ways:piety" }).line, /^Ways: piety \d+%/);
  assert.match(ask<Tip>("tip", { ref, lens: "belief" }).line, /^Belief: favour \d+/);
});

test("the acts on a people's ways, speech and faith play where they fall", () => {
  const others = ask<{ cell: number; people: number }[]>("people.map").filter((e) => e.people > 0),
    store = languagesOf(world),
    far = others.find((e) => store.of(e.cell) && store.of(e.cell) !== store.of(land.cell))!;
  world.submit("act.ways", { cell: land.cell, way: "openness", sign: 1 });
  world.submit("act.tongue", { cell: far.cell, language: store.of(land.cell)!.ref });
  world.submit("act.faith", { cell: land.cell, tenet: "teaching" });
  world.runTo(world.now + 86_400);
  const kinds = new Set(ask<ActsMap>("acts.map").acts.map((a) => a.kind));
  for (const k of ["ways", "tongue", "faith"]) assert.ok(kinds.has(k as never), `${k} plays`);
  // And the people see them: their ways changed and a faith revealed are portents to them.
  const seen = ask<{ cell: number; belief: number[] }[]>("people.map").find(
    (e) => e.cell === land.cell,
  )!;
  assert.ok(seen.belief[2]! >= 2, `portents ${seen.belief[2]}`);
});

test("one of the people under the hand holds things as the people met do: their tools, their day, their body", () => {
  const w = handOf(world).resting!,
    worker = w.agents.find((a) => a.occupation === 2 && 280 - a.birthYear > 20)!,
    p = page(`agent:${worker.id}`),
    things = blocks(p, "things");
  const held = of(things, "list").find((b) => b.title === "What they hold")!;
  assert.ok(
    held.items.some((i) => i.ref === `thing:agent:${worker.id}:hoe`),
    "a farmer's hoe",
  );
  const hoe = page(`thing:agent:${worker.id}:hoe`);
  assert.equal(hoe.kind, "thing");
  assert.ok(of(things, "composition").some((b) => b.title === "What their body is made of"));
});
