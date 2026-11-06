// Arms past the greatest fire (war-reach-plan.md W6): the numbers, each rung rarer, and a world unmade staying unmade.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadWorld,
  makeRef,
  rulesetId,
  saveWorld,
  seedFromText,
  YEAR,
} from "../src/kernel/index.ts";
import { ALIEN } from "../src/host/planet.ts";
import {
  FAR,
  chanceOfRung,
  dreadAfter,
  hullMj,
  lightMj,
  mjWords,
  rungOf,
  shareWords,
  skyMj,
  unmakeMj,
} from "../src/rules/index.ts";
import {
  STARWAR,
  civilizationsEver,
  civilizationsNear,
  clusterOf,
  contactsOf,
  farOf,
  fireOf,
  politiesOf,
  starWarsOf,
  worldsOf,
} from "../src/sim/index.ts";

const earth = { pull: 1, radius: 1, airBar: 1 };

test("a sky and a world are read off their own numbers", () => {
  const sky = skyMj(earth),
    world = unmakeMj(earth);
  assert.ok(sky > 1e17 && sky < 1e18, `Earth's sky ${sky}`);
  assert.ok(world > 1e26 && world < 4e26, `Earth's binding energy ${world}`);
  assert.equal(skyMj({ ...earth, airBar: 0 }), Infinity);
  assert.ok(skyMj({ ...earth, airBar: 10 }) > sky * 9);
  assert.ok(unmakeMj({ pull: 0.4, radius: 0.5 }) < world / 10);
});

test("a rung follows from what is commanded, and no list", () => {
  const great = hullMj(0.3),
    fusion = hullMj(0.046),
    none = { fireMj: 0, hullMj: 0, lightMj: 0, works: false };
  assert.equal(rungOf(none, earth), null);
  assert.equal(rungOf({ ...none, fireMj: 1 }, earth), "carried");
  assert.equal(rungOf({ ...none, hullMj: fusion }, earth), null);
  assert.equal(rungOf({ ...none, hullMj: great }, earth), "sky");
  assert.equal(rungOf({ ...none, hullMj: great }, { ...earth, airBar: 5 }), null);
  const light = lightMj(2.8e17, 1, 1, FAR.gatherYears);
  assert.equal(rungOf({ ...none, lightMj: light }, earth), null);
  assert.equal(rungOf({ ...none, lightMj: light, works: true }, earth), "world");
});

test("each rung is rarer and a first of one changes what rulers will do", () => {
  const d = { desperation: 0.8, valour: 0.5, fear: 0, dread: 0 },
    a = chanceOfRung("carried", d),
    b = chanceOfRung("sky", d),
    c = chanceOfRung("world", d);
  assert.ok(a > b && b > c);
  assert.ok(c < 0.001);
  assert.ok(dreadAfter("world", 0, true) > dreadAfter("sky", 0, true));
  assert.ok(chanceOfRung("sky", { ...d, dread: dreadAfter("sky", 0, true) }) < b / 10);
});

test("words read the numbers", () => {
  assert.equal(mjWords(1.2e18), "1.2 × 10^18 MJ");
  assert.equal(shareWords(1, 200), "one part in 200");
  assert.equal(shareWords(3, 1), "3.0 times over");
  assert.match(shareWords(1, Infinity), /no sky/);
});

test("the god's hand unmakes a world: dormant before, and it stays through a save", () => {
  const u = ALIEN,
    world = u.build(seedFromText("lumen 285"));
  world.runTo(2 * YEAR);
  assert.equal(farOf(world), null);
  assert.ok(fireOf(world).dormant());
  const star = clusterOf(world)[0]!,
    planet = worldsOf(world, star).findIndex((p) => p.kind === "rocky");
  assert.ok(planet >= 0);
  world.submit("far.strike", { star: star.ref, planet, rung: "world" });
  world.runTo(world.now + 1);
  const fall = fireOf(world).unmade(star.ref as string, planet);
  assert.ok(fall);
  assert.equal(fall.rung, "world");
  assert.ok(!fireOf(world).dormant());
  const doc = JSON.parse(
      JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
    ),
    back = loadWorld(doc, (s) => u.build(s), rulesetId(world, u.version), {
      allowRulesetChange: true,
    }).world;
  assert.ok(fireOf(back).unmade(star.ref as string, planet));
  assert.equal(fireOf(back).state.far?.falls.length, 1);
});

test("a war aimed at a world unmade ends with it, and its people are gone but not forgotten", () => {
  const world = ALIEN.build(seedFromText("lumen 285"));
  world.runTo(320 * YEAR);
  const y = Math.floor(world.now / YEAR),
    holder = [...politiesOf(world).living()].sort(
      (a, b) => b.members.length - a.members.length,
    )[0]!,
    civ = civilizationsNear(world).find((c) => c.stars <= y)!,
    wars = starWarsOf(world),
    ref = makeRef(STARWAR, 0, wars.all().length);
  if (!contactsOf(world).of(civ.ref))
    contactsOf(world).add({ civ: civ.ref, heard: holder.event, by: holder.ref, year: y });
  wars.add({
    ref,
    realm: holder.ref,
    enemy: civ.ref,
    declared: y,
    event: holder.event,
    sailed: y,
    arrives: y + 5,
    strength: 0.5,
    battle: null,
    won: null,
    ended: null,
  });
  world.submit("far.strike", { star: civ.star, planet: civ.planet, rung: "world" });
  world.runTo(world.now + 1);
  const fall = fireOf(world).unmade(civ.star as string, civ.planet)!;
  assert.ok(fall);
  assert.equal(wars.all().find((w) => w.ref === ref)!.ended, fall.event, "no aim left to sail for");
  assert.ok(!civilizationsNear(world).some((c) => c.ref === civ.ref), "no more of them");
  assert.ok(
    civilizationsEver(world).some((c) => c.ref === civ.ref),
    "but who they were is known",
  );
});
