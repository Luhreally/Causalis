import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { folkRef, spine, why } from "../../src/causal/index.ts";
import { cradleCell } from "../cradle.ts";

/** Where the first people of "first light" began. */
const CRADLE = cradleCell("first light");

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
  const h = ask<History>("province.history", { cell: CRADLE });
  // Every year for the last century; one year in ten before that.
  const recent = h.years.filter((y) => y.year >= 160),
    older = h.years.filter((y) => y.year < 160);
  recent.forEach((y, i) => assert.equal(y.year, 160 + i));
  assert.equal(recent.length, 100);
  // (Thinned a decade at a time: the decade just before the century is whole still.)
  assert.ok(h.years.filter((y) => y.year < 150).every((y) => y.year % 10 === 0));
  assert.ok(older.length >= 15);
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
  // The world's people every year for a century, one year in ten before that.
  const years = c.population.map((y) => y.year);
  for (let i = 1; i < years.length; i++) assert.ok(years[i]! > years[i - 1]!);
  assert.equal(years.at(-1), 259);
  assert.deepEqual(
    years.filter((y) => y >= 160),
    Array.from({ length: 100 }, (_, k) => 160 + k),
  );
  assert.ok(years.filter((y) => y < 150).every((y) => y % 10 === 0));
  assert.ok(years.length >= 115);
  const last = c.population.at(-1)!,
    map = ask<{ people: number }[]>("people.map");
  assert.ok(Math.abs(last.people - map.reduce((s, p) => s + p.people, 0)) < last.people * 0.05);
});

test("the people of a province explain themselves, back to the first people and the land", () => {
  const node = why(world, folkRef(CRADLE));
  assert.equal(node.basis, "recorded");
  assert.match(
    node.claim,
    /^[\d,]+ people live in the .*, peopled since year 0; in the last ten years [\d,]+ were born and [\d,]+ died/,
  );
  const kinds = spine(world, folkRef(CRADLE)).map((e) => e.ref.split(":")[0]);
  assert.equal(kinds.at(-1), "star", kinds.join(" ← "));
  const facts = ask<{ folk: Ref }>("province", { cell: CRADLE });
  assert.equal(facts.folk, folkRef(CRADLE));
});

test("a century of watching a village meets its families through the observer and never changes history", () => {
  const quiet = EARTH.build(seedFromText("first light")),
    busy = EARTH.build(seedFromText("first light"));
  quiet.runTo(240 * YEAR);
  busy.runTo(240 * YEAR);
  const ref = (EARTH.queries.settlements!(busy, { cell: CRADLE }) as { ref: string }[])[0]!.ref;
  type Plan = { people: { ref: string; home: number }[]; homes: { household: string | null }[] };
  const first = EARTH.queries["village.plan"]!(busy, { ref }) as Plan;
  assert.ok(first.people.length >= 10, `${first.people.length} watched`);
  assert.ok(first.people.every((p) => first.homes[p.home]!.household !== null));
  for (let year = 241; year <= 340; year++) {
    quiet.runTo(year * YEAR);
    busy.runTo(year * YEAR);
    const again = EARTH.queries["village.plan"]!(busy, { ref }) as Plan;
    assert.ok(again.people.length <= first.people.length + 60);
    // And look closer at someone each decade: their whole life, told.
    if (year % 10 === 0 && again.people[0])
      EARTH.queries["observe.person"]!(busy, { ref: again.people[0].ref });
  }
  assert.deepEqual(
    busy.checkpoints().map((c) => c.chain),
    quiet.checkpoints().map((c) => c.chain),
    "the watched village's history is the unwatched one's",
  );
});
