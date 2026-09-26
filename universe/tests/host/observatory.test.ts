import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { folkRef, spine, why } from "../../src/causal/index.ts";

const world = EARTH.build(seedFromText("first light"));
world.runTo(260 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;

type History = {
  years: { year: number; population: number; fed: number }[];
  prices: { year: number; food: number; tools: number }[];
};
type Chronicle = {
  events: { ref: string; year: number; importance: number; claim: string }[];
  population: { year: number; people: number }[];
};

test("a province's years come back in order, one line a year, for the charts", () => {
  const h = ask<History>("province.history", { cell: 30210 });
  assert.equal(h.years.length, 260);
  h.years.forEach((y, i) => assert.equal(y.year, i));
  assert.ok(h.years.every((y) => y.population > 0 && y.fed >= 0 && y.fed <= 100));
  assert.ok(h.prices.length >= 100 && h.prices.every((p) => p.food > 0 && p.tools > 0));
});

test("the chronicle is newest first, in words, and adds up the world's people by year", () => {
  const c = ask<Chronicle>("chronicle", { limit: 40 });
  assert.ok(c.events.length > 10);
  for (let i = 1; i < c.events.length; i++) assert.ok(c.events[i - 1]!.year >= c.events[i]!.year);
  for (const e of c.events) {
    assert.ok(e.importance >= 4);
    assert.doesNotMatch(e.claim, /\(t=\d+\)|^[a-z]+\.[a-z-]+ /, `said in words: ${e.claim}`);
  }
  assert.equal(c.population.length, 260);
  const last = c.population.at(-1)!,
    map = ask<{ people: number }[]>("people.map");
  assert.ok(Math.abs(last.people - map.reduce((s, p) => s + p.people, 0)) < last.people * 0.05);
});

test("the people of a province explain themselves, back to the first people and the land", () => {
  const node = why(world, folkRef(30210));
  assert.equal(node.basis, "recorded");
  assert.match(
    node.claim,
    /^[\d,]+ people live in the .*, peopled since year 0; in the last ten years [\d,]+ were born and [\d,]+ died/,
  );
  const kinds = spine(world, folkRef(30210)).map((e) => e.ref.split(":")[0]);
  assert.equal(kinds.at(-1), "star", kinds.join(" ← "));
  const facts = ask<{ folk: Ref }>("province", { cell: 30210 });
  assert.equal(facts.folk, folkRef(30210));
});

test("watching a village meets its families through the observer and never changes history", () => {
  const quiet = EARTH.build(seedFromText("first light")),
    busy = EARTH.build(seedFromText("first light"));
  quiet.runTo(240 * YEAR);
  busy.runTo(240 * YEAR);
  const ref = (EARTH.queries.settlements!(busy, { cell: 30210 }) as { ref: string }[])[0]!.ref;
  type Plan = { people: { ref: string; home: number }[]; homes: { household: string | null }[] };
  const first = EARTH.queries["village.plan"]!(busy, { ref }) as Plan;
  assert.ok(first.people.length >= 10, `${first.people.length} watched`);
  assert.ok(first.people.every((p) => first.homes[p.home]!.household !== null));
  for (let year = 241; year <= 250; year++) {
    quiet.runTo(year * YEAR);
    busy.runTo(year * YEAR);
    const again = EARTH.queries["village.plan"]!(busy, { ref }) as Plan;
    assert.ok(again.people.length <= first.people.length + 60);
  }
  assert.deepEqual(
    busy.checkpoints().map((c) => c.chain),
    quiet.checkpoints().map((c) => c.chain),
    "the watched village's history is the unwatched one's",
  );
});
