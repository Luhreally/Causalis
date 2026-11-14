// How a realm is held, on a real world (sim/order/holds.ts): Earth's first light to year 400. Every living realm keeps its four numbers;
// some are told anew as history moves them; realms learn of rule from what befell them and from others' fates they could know of, each
// lesson's blame read off their ways; and the realm's page and Learned tab say so in words read off the numbers and the people.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { HOLD_EVENTS, orderOf, politiesOf } from "../../src/sim/index.ts";
import type { PageModel } from "../../src/bridge/index.ts";

const world = EARTH.build(seedFromText("first light"));
world.runTo(400 * YEAR);
const store = orderOf(world)!,
  living = politiesOf(world).living();
const events = (type: string) => {
  const out = [];
  for (let i = 0; i < world.events.count; i++)
    if (world.events.at(i).type === type) out.push(world.events.at(i));
  return out;
};

test("every living realm keeps four numbers, whole hundredths of 0 … 100, and they differ between realms", () => {
  assert.ok(living.length > 5);
  const seen = new Set<string>();
  for (const p of living) {
    const held = store.of(p.ref)?.held;
    assert.ok(held && held.length === 4, `${p.ref} keeps its numbers`);
    for (const v of held) assert.ok(Number.isInteger(v) && v >= 0 && v <= 100, `${p.ref}: ${held}`);
    seen.add(held.join(","));
  }
  assert.ok(seen.size > living.length / 3, `${seen.size} kinds among ${living.length} realms`);
});

test("history moves them: realms told held anew, and lessons of rule, each with an outcome, a blame and a change", () => {
  const held = events(HOLD_EVENTS.held.type),
    lessons = events(HOLD_EVENTS.lesson.type);
  assert.ok(held.length > 0, "some realm came to be held otherwise");
  assert.ok(lessons.length > 0, "some realm learned of rule");
  for (const e of lessons) {
    const d = e.data as { outcome: string; blame: string };
    assert.ok(d.outcome && d.blame, JSON.stringify(d));
  }
  const taught = living.flatMap((p) => store.of(p.ref)?.taught ?? []);
  assert.ok(taught.length > 0, "realms keep what they learned");
});

test("a realm's page tells how it is held, and its Learned tab what befell it and others", () => {
  const page = (ref: string) => EARTH.queries.page!(world, { ref }) as PageModel,
    text = (p: PageModel) => JSON.stringify(p.tabs.flatMap((t) => t.blocks));
  const p = living.find((x) => store.of(x.ref)?.taught?.length)!;
  assert.ok(p, "a realm that learned of rule");
  const all = text(page(p.ref));
  assert.match(all, /How it is held/);
  assert.match(all, /Who bears arms/);
  assert.match(all, /Who decides/);
  assert.match(all, /How word moves/);
  assert.match(all, /From what befell them and others/);
  assert.doesNotMatch(all, /\{them\}|undefined|NaN/);
});

test("a number told anew says since what: the coup, the revolution, or the lesson behind the weighing that moved it", () => {
  const p = living.find((x) => store.of(x.ref)?.heldEvents?.some((e) => e));
  assert.ok(p, "a realm with a number told anew");
  const all = JSON.stringify(
    (EARTH.queries.page!(world, { ref: p.ref }) as PageModel).tabs.flatMap((t) => t.blocks),
  );
  // (The words, then what it stands since, a link: ", since ", {"text":"the coup of year 412", …}.)
  assert.match(all, /", since ",\{"text":"[a-z' ]*year \d+"/);
});
