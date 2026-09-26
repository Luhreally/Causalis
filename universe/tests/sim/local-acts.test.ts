import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  verifyByReplay,
  type Ref,
  type World,
} from "../../src/kernel/index.ts";
import {
  LOCAL_ACT_EVENTS,
  LORE_EVENTS,
  USE,
  citiesOf,
  handOf,
  loreOf,
  makePopulationWorld,
  populationContext,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { cradleCell } from "../cradle.ts";

const seed = seedFromText("first light"),
  HOME = cradleCell("first light");
const build = () => makePopulationWorld(seed);
const domain = (w: World, name: string) => w.domainHashes().find(([d]) => d === name)?.[1];
const chain = (w: World) => w.checkpoints().map((c) => c.chain);

test("a spring opened at a village draws the land's settlers to it", () => {
  const pure = build(),
    sprung = build();
  pure.runTo(240 * YEAR);
  sprung.runTo(240 * YEAR);
  const small = populationContext(sprung)
    .settlements.inProvince(HOME)
    .filter((v) => !v.market)
    .sort((a, b) => a.population - b.population || (a.ref < b.ref ? -1 : 1))[0]!;
  const act = sprung.submit("act.spring", { village: small.ref });
  pure.runTo(260 * YEAR);
  sprung.runTo(260 * YEAR);
  const now = (w: World) => populationContext(w).settlements.get(small.ref)!;
  assert.ok(
    now(sprung).population > now(pure).population * 1.15,
    `${now(sprung).population} with the spring, ${now(pure).population} without`,
  );
  const e = sprung.events.get(now(sprung).spring!)!;
  assert.equal(e.type, LOCAL_ACT_EVENTS.spring.type);
  assert.equal(e.causes[0]!.ref, act.id, "the spring cites the act");
  assert.match(why(sprung, e.id).claim, /a spring welled up at/);
  assert.throws(() => sprung.submit("act.spring", { village: small.ref }), /already rises/);
});

test("a shrine is a sign the devout read; raising one twice is refused", () => {
  const world = build();
  world.runTo(240 * YEAR);
  const v = populationContext(world).settlements.inProvince(HOME)[0]!;
  world.submit("act.shrine", { village: v.ref });
  world.runTo(240 * YEAR + 1);
  assert.ok(populationContext(world).settlements.get(v.ref)!.shrine, "the shrine stands");
  assert.throws(() => world.submit("act.shrine", { village: v.ref }), /already stands/);
  const village = populationContext(world)
    .settlements.inProvince(HOME)
    .find((s) => !citiesOf(world).get(s.ref))!;
  assert.throws(() => world.submit("act.fire", { village: village.ref }), /only a city burns/);
  assert.throws(() => world.submit("act.shrine", { village: "town:0:999999" }), /no village/);
});

test("fire on a city burns a fifth of its quarters and kills a hundredth of its people", () => {
  const world = EARTH.build(seed);
  world.runTo(320 * YEAR);
  const ctx = populationContext(world),
    city = citiesOf(world).all()[0]!,
    town = ctx.settlements.get(city.town)!,
    built = city.uses.filter((u) => u !== USE.open).length,
    people = town.population,
    dead = ctx.history.deathsIn(town.cell, 320);
  const act = world.submit("act.fire", { village: city.town });
  world.runTo(320 * YEAR + 1);
  const standing = city.uses.filter((u) => u !== USE.open).length;
  assert.equal(built - standing, Math.ceil((built - 1) / 5), "a fifth of the built blocks burn");
  assert.equal(city.uses.filter((u) => u === USE.temple).length, 1, "the temple stands");
  const fallen = ctx.history.deathsIn(town.cell, 320) - dead;
  assert.ok(
    fallen >= people / 200 && fallen <= Math.round(people / 100),
    `${fallen} died of ${people}`,
  );
  for (const p of ctx.provinces.all())
    for (let r = 0; r < 20; r++) for (let o = 0; o < 7; o++) assert.ok(p.counts.get(r, o) >= 0);
  const fire = world.events.all().find((e) => e.type === LOCAL_ACT_EVENTS.fire.type)!;
  assert.equal(fire.causes[0]!.ref, act.id);
  // The city rebuilds, a few blocks a year, toward what its worth asks.
  world.runTo(330 * YEAR);
  assert.ok(city.uses.filter((u) => u !== USE.open).length > standing, "the city rebuilds");
});

test("one person inspired comes upon what their land could know next, and is remembered for it", () => {
  const world = build();
  world.runTo(240 * YEAR);
  const v = populationContext(world).settlements.inProvince(HOME)[0]!;
  assert.throws(() => world.submit("act.inspire-one", { agent: 1 }), /rests on no village/);
  world.submit("hand.lay", { village: v.ref });
  world.runTo(240 * YEAR + 1);
  const hand = handOf(world).resting!,
    one = hand.agents.find((a) => 240 - a.birthYear >= 20)!;
  assert.throws(() => world.submit("act.inspire-one", { agent: -5 }), /no such person/);
  const act = world.submit("act.inspire-one", { agent: one.id });
  world.runTo(240 * YEAR + 2);
  const deed = hand.notables!.find((n) => n.agent === one.id)!,
    inspired = world.events.get(deed.deed)!;
  assert.equal(inspired.causes[0]!.ref, act.id);
  const principle = (inspired.data as { principle: string }).principle;
  assert.ok(principle, "something their land did not know");
  const found = world.events
    .all()
    .find((e) => e.type === LORE_EVENTS.found.type && e.causes[0]?.ref === deed.deed)!;
  assert.equal((found.data as { principle: string }).principle, principle);
  assert.equal(loreOf(world).get(HOME, principle)?.event, found.id, "the land knows it now");
  assert.match(why(world, deed.deed).claim, /was inspired, and came upon/);
});

test("one person blessed is spared death for twenty years while the hand rests", () => {
  const world = build();
  world.runTo(240 * YEAR);
  const v = populationContext(world).settlements.inProvince(HOME)[0]!;
  world.submit("hand.lay", { village: v.ref });
  world.runTo(240 * YEAR + 1);
  const hand = handOf(world).resting!,
    eldest = [...hand.agents].sort((a, b) => a.birthYear - b.birthYear || a.id - b.id)[0]!;
  world.submit("act.bless-one", { agent: eldest.id });
  for (let year = 241; year <= 259; year++) {
    world.runTo(year * YEAR);
    assert.ok(
      hand.agents.some((a) => a.id === eldest.id),
      `the blessed, ${year - eldest.birthYear}, lives in year ${year}`,
    );
  }
  assert.equal(eldest.blessedUntil, 260);
});

test("a world touched by the finer acts replays, and its save continues, bit for bit", () => {
  const world = build();
  world.runTo(238 * YEAR);
  const vs = populationContext(world).settlements.inProvince(HOME);
  world.submit("act.shrine", { village: vs[1]!.ref });
  world.runTo(239 * YEAR);
  world.submit("act.spring", { village: vs[2]!.ref });
  world.submit("hand.lay", { village: vs[0]!.ref });
  world.runTo(240 * YEAR);
  const [a, b] = handOf(world).resting!.agents;
  world.submit("act.inspire-one", { agent: a!.id });
  world.submit("act.bless-one", { agent: b!.id });
  world.runTo(246 * YEAR);
  const ruleset = rulesetId(world, "test"),
    doc = saveWorld(world, ruleset);
  assert.deepEqual(verifyByReplay(doc, build), { ok: true, problem: null });
  const loaded = loadWorld(doc, build, ruleset).world;
  world.runTo(252 * YEAR);
  loaded.runTo(252 * YEAR);
  assert.deepEqual(chain(loaded), chain(world));
  assert.equal(domain(loaded, "hand"), domain(world, "hand"));
  assert.ok(
    handOf(loaded).resting!.notables!.every((n) => loaded.events.get(n.deed as Ref)),
    "the deeds of the touched are kept",
  );
});
