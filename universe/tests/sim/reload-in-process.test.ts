// An earlier save loaded in the same process as the world that ran on from it (a player loading an earlier save in one session):
// the loaded world goes the way the first went, year by year. Nothing a module keeps may hold what a world has since done: what
// is kept beside a world is kept in its stores, by all it was read from (found 2026-11-20: two worlds of first light in one
// process, the first run ahead to 1,510 before the second was loaded from its save at 1,500, parted in the first year).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type SaveDocument,
} from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { mindsOf, politiesOf, populationContext } from "../../src/sim/index.ts";
import { reachNow } from "../../src/sim/order/order.ts";
import { universeWorld } from "../host/worlds.ts";

const AT = 130,
  AHEAD = 12;

test("an earlier save loaded in the same process goes the way the world that ran on from it went", () => {
  const first = universeWorld(EARTH, "first light", AT),
    ruleset = rulesetId(first, "test"),
    doc = JSON.parse(JSON.stringify(saveWorld(first, ruleset))) as SaveDocument,
    went: (readonly [string, string])[][] = [];
  // (The first runs all its years ahead before the second is so much as loaded.)
  for (let y = 1; y <= AHEAD; y++) {
    first.runTo((AT + y) * YEAR);
    went.push(first.domainHashes());
  }
  const { world: second } = loadWorld(doc, EARTH.build, ruleset);
  for (let y = 1; y <= AHEAD; y++) {
    second.runTo((AT + y) * YEAR);
    assert.deepEqual(second.domainHashes(), went[y - 1], `year ${AT + y}`);
  }
  // (And the first, run on while the second stood beside it, is not moved by it: both go on alike.)
  first.runTo((AT + AHEAD + 3) * YEAR);
  second.runTo((AT + AHEAD + 3) * YEAR);
  assert.deepEqual(second.domainHashes(), first.domainHashes());
});

test("a realm's reach is the same however many worlds the process has made", () => {
  // (What bears on reach is a list a module keeps, and the minds gave it a new function at each world's making: a realm whose
  // minds counsel it was counselled once more for every world made since. One made mind is given here, past its makers.)
  const world = universeWorld(EARTH, "first light", AT),
    ctx = populationContext(world),
    realm = politiesOf(world).living()[0]!;
  mindsOf(world)!.rows.set(realm.ref, {
    realm: realm.ref,
    begun: AT - 30,
    past: 150,
    passed: realm.event,
    free: null,
    name: "Asked",
  });
  const before = reachNow(ctx, realm).seat;
  EARTH.build(seedFromText("first light"));
  EARTH.build(seedFromText("another seed"));
  assert.equal(reachNow(ctx, realm).seat, before);
});
