import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type Ref } from "../../src/kernel/index.ts";
import { G, principle } from "../../src/rules/index.ts";
import { ALIEN } from "../../src/host/planet.ts";
import {
  STARWAR_EVENTS,
  civilizationsNear,
  contactsOf,
  loreOf,
  marketsOf,
  politiesOf,
  spaceOf,
  starWarsOf,
} from "../../src/sim/index.ts";
import { spine } from "../../src/causal/index.ts";
import { universeWorld } from "../host/worlds.ts";

test("a war between the stars: declared on old news, its fleet years on the way, its why back to the home world's pull", () => {
  // A world whose neighbours include a people long among the stars, and a realm of its own: alien 41's people find sowing
  // by their own crowding and soil (no realm stands before a land sows), and since the breadth round none has by 150; by
  // 200 a hundred and fifty-five lands sow and thirteen realms stand.
  const AT = 200,
    world = universeWorld(ALIEN, "alien 41", AT);
  assert.ok(
    civilizationsNear(world).some((c) => c.stars < 0),
    "an old starfaring people near",
  );
  const realm = [...politiesOf(world).living()].sort(
    (a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1),
  )[0]!;
  for (const id of ["mathematics", "electronics", "fusion-drive", "antimatter-drive"])
    loreOf(world).learn(realm.seat, id, { year: AT, event: realm.event }, principle(id));
  // Its reach into the sky: a first satellite of its own, and machines for a fleet.
  const prog = spaceOf(world).program(realm.ref);
  prog.satellite = realm.event;
  // (And kept so through the years it waits on a cause and its rulers' will: since the release's rules its machines ran down
  // below a fleet's in a century, a realm of a year's chance in fifty to go having no war in it.)
  const stocked = () => {
    const m = marketsOf(world).of(realm.seat),
      short = 60_000_000 - m.stock[G.machines]!;
    if (short > 0) m.move("made", G.machines, short);
  };
  stocked();
  let y = AT;
  while (!starWarsOf(world).all().length && y < AT + 200) {
    world.runTo(++y * YEAR);
    stocked();
  }
  assert.ok(contactsOf(world).all().length > 0, "another people heard");
  const war = starWarsOf(world).all()[0]!;
  assert.ok(war, "a war declared");
  const e = world.events.get(war.event)!;
  assert.equal(e.type, STARWAR_EVENTS.declared.type);
  assert.ok(war.arrives - war.sailed > 20, `${war.arrives - war.sailed} years on the way`);
  // Its why: the hearing of the other people, and the realm's own reach into the sky.
  const decision = world.decisions.get(e.causes[0]!.ref as Ref)!;
  assert.ok(decision.factors.some((f) => f.source?.ref === prog.satellite));
  assert.ok(decision.factors.some((f) => /starfaring people/.test(f.name)));
  const walk = spine(world, e.id, 8).map((x) => x.ref);
  assert.ok(walk.some((r) => r.startsWith("civ:") || r.startsWith("ev:")));
  // The fleet arrives, and fights.
  world.runTo((war.arrives + 1) * YEAR);
  assert.ok(war.battle && war.ended, "a battle on arrival, and the war's end");
});
