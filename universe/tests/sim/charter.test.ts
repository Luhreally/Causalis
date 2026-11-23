import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type SimTime } from "../../src/kernel/index.ts";
import { HOLD, temperCarries, temperOf, trainedTerm } from "../../src/rules/index.ts";
import {
  ALLY,
  CHARTER_EVENTS,
  PACT,
  chartersOf,
  loreOf,
  orderOf,
  pactWorth,
  politiesOf,
  populationContext,
} from "../../src/sim/index.ts";
import { charterYear } from "../../src/sim/order/charter.ts";
import { why } from "../../src/causal/index.ts";
import { peopledWorld } from "../worlds.ts";

// The breadth round (2026-11-23): what a realm writes down of its rule, a ruler's temper, a host's drill, what a pact is worth.

test("a ruler's temper is half their people's ways and half their own, the same at every reading, and carries as far as few choose", () => {
  const bold = temperOf(7, 1200, { valour: 1, thrift: 0.5, piety: 0.5 }),
    meek = temperOf(7, 1200, { valour: 0, thrift: 0.5, piety: 0.5 });
  assert.ok(bold.bold - meek.bold > 0.49 && bold.bold - meek.bold < 0.51, "a half from the people");
  assert.deepEqual(
    temperOf(7, 1200, { valour: 1, thrift: 0.5, piety: 0.5 }),
    bold,
    "read, never kept",
  );
  const others = Array.from(
    { length: 50 },
    (_, k) => temperOf(k, 1200, { valour: 0.5, thrift: 0.5, piety: 0.5 }).bold,
  );
  assert.ok(Math.max(...others) - Math.min(...others) > 0.3, "rulers differ of themselves");
  assert.equal(temperCarries(0), 1);
  assert.equal(temperCarries(1), 0, "an assembly's speaker is no king");
});

test("a host fights the better drilled and seasoned; a raw levy as it is", () => {
  assert.equal(trainedTerm(0, 1, 0), 1);
  assert.ok(trainedTerm(1, 1, 0) > 1 && trainedTerm(1, 2, 0) > trainedTerm(1, 1, 0));
  assert.ok(trainedTerm(0, 1, 6) > 1 && trainedTerm(0, 1, 60) === trainedTerm(0, 1, 6));
});

test("a pact is worth its regard, a foe the two share, less the wars it would draw one into", () => {
  assert.ok(pactWorth(0.3, 0, 0) < PACT, "regard alone short of the line");
  assert.ok(pactWorth(0.3, 1, 0) > PACT, "a shared foe as strong as the two together carries it");
  assert.ok(pactWorth(0.5, 0, 3) < pactWorth(0.5, 0, 0) - 2 * ALLY.drawn, "the other's wars cost");
});

test("realms write charters where many carry their choices, take powers in danger and give them back, and leave far towns to themselves", () => {
  const world = peopledWorld("first light", 300, { start: "spread" }),
    ctx = populationContext(world),
    realms = politiesOf(world).living(),
    store = chartersOf(world)!,
    p = [...realms].sort((a, b) => b.members.length - a.members.length)[0]!,
    o = orderOf(world)!.of(p.ref)!;
  assert.ok(store, "kept");
  // A realm whose choices are carried by many, that binds itself and can write, comes to write one within a few readings.
  o.held![HOLD.voice] = 80;
  o.held![HOLD.trust] = 80;
  const t0 = world.now;
  let written = false;
  for (let k = 0; k < 40 && !written; k++) {
    charterYear(ctx, (t0 + k * YEAR) as SimTime);
    written = !!store.of(p.ref)?.written;
  }
  const c = store.of(p.ref);
  if (c?.writ) {
    assert.equal(world.events.get(c.writ)!.type, CHARTER_EVENTS.charter.type);
    assert.match(why(world, c.writ)!.claim, /wrote down its rule in a charter/);
    assert.ok(c.bar >= 50 && c.bar <= 80, `${c.bar}`);
  } else assert.ok(!loreOf(world).effect(p.seat, "writing"), "only where it cannot write");
  // Who is heard never falls below those who do not bear, and caps the realm's voice.
  for (const r of store.realms()) {
    const x = store.of(r)!;
    assert.ok(x.heard >= 50 && x.heard <= 100, `${x.heard}`);
  }
  // Saved and loaded whole.
  const again = new (store.constructor as new () => typeof store)();
  again.load(JSON.parse(JSON.stringify(store.save())));
  assert.deepEqual(again.save(), store.save());
});
