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
