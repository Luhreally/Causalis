import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref, type World } from "../../src/kernel/index.ts";
import { offworldSite } from "../../src/gen/index.ts";
import { G, principle } from "../../src/rules/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  COLONISTS,
  SPACE_EVENTS,
  homePlanet,
  languagesOf,
  loreOf,
  marketsOf,
  politiesOf,
  populationContext,
  prospects,
  spaceOf,
  type Polity,
} from "../../src/sim/index.ts";
import { landWords, why } from "../../src/causal/index.ts";

const ROAD = [
  "mathematics",
  "astronomy",
  "medicine",
  "steel",
  "engines",
  "electricity",
  "electronics",
  "rocketry",
  "guidance",
  "orbital-flight",
  "life-support",
  "stations",
  "transfer-flight",
  "habitats",
];

/** Earth grown a while, its largest realm taught the road to the other worlds, with a station and machines. */
function readied(): { world: World; realm: Polity } {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(80 * YEAR);
  const realm = [...politiesOf(world).living()].sort(
      (a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1),
    )[0]!,
    lore = loreOf(world);
  for (const id of ROAD)
    lore.learn(realm.seat, id, { year: 80, event: realm.event }, principle(id));
  marketsOf(world).of(realm.seat).move("made", G.machines, 60_000_000);
  spaceOf(world).program(realm.ref).station = realm.event;
  return { world, realm };
}

test("a realm with a station and the knowledge of habitats sets its settlers down on another body, as a land of its own", () => {
  const { world, realm } = readied(),
    ctx = populationContext(world),
    choices = prospects(ctx, realm);
  assert.ok(choices.length > 0, "somewhere it can reach and live");
  let y = 80;
  while (!spaceOf(world).of(realm.ref)!.colonies.length && y < 200) world.runTo(++y * YEAR);
  const c = spaceOf(world).of(realm.ref)!.colonies[0]!;
  assert.ok(c, "a colony within a century");
  const g = homePlanet(world).generated,
    site = offworldSite(g, c.cell)!,
    body = g.system.bodies[site.body]!;
  assert.ok(site && body.kind !== "home", "on another body");
  const land = ctx.provinces.get(c.cell)!;
  assert.ok(land.total() > 0.8 * COLONISTS, `${land.total()} settlers`);
  // A land of the realm, knowing what its seat knew, speaking its tongue.
  assert.equal(politiesOf(world).of(c.cell)?.ref, realm.ref);
  assert.ok(loreOf(world).get(c.cell, "habitats"));
  // They carry their own land's tongue.
  assert.ok(languagesOf(world).of(c.cell), "a tongue carried");
  // Its why: the body and the way there.
  const e = world.events.get(c.event)!;
  assert.equal(e.type, SPACE_EVENTS.colony.type);
  const decision = world.decisions.get(e.causes[0]!.ref as Ref)!;
  assert.ok(
    decision.factors.some((f) => f.source?.ref === body.ref),
    "the body it went to",
  );
  assert.match(why(world, body.ref).claim, new RegExp(body.designation));
  assert.match(landWords(world, land.ref), /the halls on/);
  // It lives: fed, and still there decades on.
  world.runTo((y + 40) * YEAR);
  assert.ok(land.total() > 0.8 * COLONISTS, `${land.total()} forty years on`);
  assert.ok(land.fed >= 800, `fed ${land.fed}`);
});
