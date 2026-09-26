import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref, type World } from "../../src/kernel/index.ts";
import { G, principle } from "../../src/rules/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  SPACE_EVENTS,
  launcherOfRealm,
  loreOf,
  marketsOf,
  politiesOf,
  populationContext,
  spaceOf,
  type Polity,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";

/** A grown Earth, and its largest realm taught the road to orbit and given machines. */
function readied(extra: string[] = []): { world: World; realm: Polity } {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(60 * YEAR);
  const realm = [...politiesOf(world).living()].sort(
      (a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1),
    )[0]!,
    lore = loreOf(world);
  for (const id of [
    "mathematics",
    "astronomy",
    "steel",
    "engines",
    "electricity",
    "electronics",
    "rocketry",
    "guidance",
    "orbital-flight",
    ...extra,
  ])
    lore.learn(realm.seat, id, { year: 60, event: realm.event }, principle(id));
  marketsOf(world).of(realm.seat).move("made", G.machines, 20_000_000);
  return { world, realm };
}

test("a realm that knows orbital flight and has the machines sends up its first satellite, and its why reaches the world's pull and the engine", () => {
  const { world, realm } = readied(),
    ctx = populationContext(world),
    launcher = launcherOfRealm(ctx, realm)!;
  assert.ok(launcher, "a launcher its seat can build for the home world");
  let t = 60;
  while (!spaceOf(world).of(realm.ref)?.satellite && t < 200) world.runTo(++t * YEAR);
  const first = spaceOf(world).of(realm.ref)!.satellite!;
  assert.ok(first, "a first satellite within a century");
  const e = world.events.get(first)!;
  assert.equal(e.type, SPACE_EVENTS.satellite.type);
  assert.equal(spaceOf(world).first.satellite, first);
  // Its why: the decision, whose factors name the speed to orbit (the planet) and the engine.
  const decision = world.decisions.get(e.causes[0]!.ref as Ref)!;
  assert.ok(
    decision.factors.some((f) => f.source?.ref === "plnt:0:0"),
    "the world's pull",
  );
  assert.ok(
    decision.factors.some((f) => /exhaust/.test(f.name)),
    "the engine",
  );
  assert.match(why(world, first).claim, /first satellite into orbit/);
  // The machines were spent.
  assert.ok(Number(e.data && (e.data as { cost: number }).cost) > 10_000);
});

test("no realm flies without orbital flight, however rich", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(60 * YEAR);
  for (const p of politiesOf(world).living())
    marketsOf(world).of(p.seat).move("made", G.machines, 50_000_000);
  world.runTo(80 * YEAR);
  assert.equal(spaceOf(world).first.satellite, null);
});
