import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { principle } from "../../src/rules/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  CONTACT_EVENTS,
  civilizationsNear,
  contactsOf,
  loreOf,
  politiesOf,
} from "../../src/sim/index.ts";
import { spine, why } from "../../src/causal/index.ts";

test("the cluster holds other peoples, each on a world of seas about an old enough star", () => {
  const world = EARTH.build(seedFromText("first light")),
    civs = civilizationsNear(world);
  assert.ok(civs.length >= 1 && civs.length <= 12, `${civs.length}`);
  for (const c of civs) {
    assert.ok(c.distance > 0 && c.distance <= 50);
    assert.ok(
      c.orbit >= c.electronics && c.stars >= c.orbit,
      "electronics, then orbit, then the stars",
    );
  }
});

test("another people is heard when its signals arrive and a realm can listen; the why reaches their world", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(80 * YEAR);
  assert.equal(contactsOf(world).all().length, 0, "no one listens without electronics");
  const realm = [...politiesOf(world).living()].sort(
    (a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1),
  )[0]!;
  for (const id of ["mathematics", "electricity", "electronics"])
    loreOf(world).learn(realm.seat, id, { year: 80, event: realm.event }, principle(id));
  world.runTo(82 * YEAR);
  const heard = contactsOf(world).all();
  // Those whose signals have had time to cross are heard; none sooner.
  const civs = civilizationsNear(world),
    due = civs.filter((c) => c.electronics + Math.ceil(c.distance) <= 81);
  assert.equal(heard.length, due.length);
  assert.ok(heard.length >= 1, "an old people's signals were already arriving");
  const e = world.events.get(heard[0]!.heard)!;
  assert.equal(e.type, CONTACT_EVENTS.heard.type);
  assert.match(why(world, e.id).claim, /heard the signals of another people/);
  // Down the why: the people (generated from their world), and on to their star.
  const civ = e.causes.find((c) => c.role === "trigger")!.ref as Ref;
  assert.match(why(world, civ).claim, /light-years from home/);
  assert.ok(spine(world, civ, 4).some((x) => x.ref.startsWith("star:")));
});
