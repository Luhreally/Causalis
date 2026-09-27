import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { ECONOMY_EVENTS, warsOf } from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";

test("war shuts trade between the realms at war: an embargo, told once, its why the war", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(160 * YEAR);
  const embargoes = world.events.all().filter((e) => e.type === ECONOMY_EVENTS.embargo.type);
  assert.ok(embargoes.length > 0, "some war cut trade");
  const e = embargoes[0]!,
    war = warsOf(world)
      .all()
      .find((w) => w.embargo === e.id);
  // Its cause is the war's declaration; it names both realms.
  assert.equal(world.events.get(e.causes[0]!.ref)!.type, "war.declared");
  assert.equal(e.subjects.length, 2);
  assert.match(why(world, e.id).claim, /War shut the trade/);
  // Told once for each war.
  const perWar = new Map<string, number>();
  for (const x of embargoes) perWar.set(x.causes[0]!.ref, (perWar.get(x.causes[0]!.ref) ?? 0) + 1);
  assert.ok([...perWar.values()].every((n) => n === 1));
  void war;
});
