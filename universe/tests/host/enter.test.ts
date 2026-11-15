import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng, YEAR, seedFromText, seedName } from "../../src/kernel/index.ts";
import {
  civBody,
  farCrafts,
  farShut,
  foreignPlanets,
  worldChemistry,
  worldLife,
} from "../../src/gen/index.ts";
import { affordancesOf, farMade, makingsOf } from "../../src/rules/index.ts";
import { ALIEN, EARTH, clusterOf } from "../../src/host/planet.ts";
import { enterPlan, enteredHere } from "../../src/host/enter.ts";
import { folkFacts, peopleFigure } from "../../src/host/folk.ts";
import { folkFactsOf, folkFigure } from "../../src/host/natives.ts";
import { enteredSeed, seedShown, type EnterPlan } from "../../src/bridge/index.ts";
import {
  folkPeople,
  folkStage,
  folksNear,
  homePlanet,
  knownAt,
  loreOf,
  populationContext,
  shutAge,
  type Folk,
} from "../../src/sim/index.ts";

// A world of another star entered (asked 2026-11-13): made from what was read of it from the home world, so the star,
// the world's numbers, its chemistry and its people are the ones seen; a world of its own from there on.
const home = EARTH.build(seedFromText("first light ~size small")),
  folks = folksNear(home),
  starOf = (f: Folk) => clusterOf(home).find((s) => s.ref === f.star)!,
  planetOf = (f: Folk) => foreignPlanets(new Rng(home.seed), starOf(f))[f.planet]!,
  plan = (f: Folk) => enterPlan(home, f.star, f.planet, "earth"),
  ok = (p: EnterPlan) => {
    assert.ok(p.ok, p.ok ? "" : p.why);
    return p;
  },
  // (One in its camps, one of the cluster's followed few further on, one of another medium than the land.)
  camped = folks.find(
    (f) => !f.followed && folkStage(f, 0) === "camps" && f.body.medium === "land",
  )!,
  followed = folks.find((f) => f.followed && !["camps", "ruins"].includes(folkStage(f, 0)))!,
  wet = folks.find((f) => f.body.medium !== "land" && folkStage(f, 0) !== "ruins")!;

test("the stars about the home world hold peoples to enter", () => {
  assert.ok(camped && followed && wet, `${folks.length} peoples`);
});

for (const [what, pick] of [
  ["a people in its camps", () => camped],
  ["a people history follows", () => followed],
  ["a people not of the land", () => wet],
] as const)
  test(`${what}: its world is made from what was read of it`, () => {
    const f = pick(),
      s = starOf(f),
      p = planetOf(f),
      got = ok(plan(f)),
      far = farMade(got.seed)!;
    assert.equal(got.universe, "alien");
    assert.equal(got.name, f.name);
    assert.equal(got.stage, folkStage(f, 0));
    // The seed says whose world it is and where it was seen from, and keeps the home world's size.
    assert.equal(seedName(got.seed), `${f.name}, from first light ${s.sector}:${s.k}/${f.planet}`);
    assert.equal(makingsOf(got.seed).size, "small");
    assert.equal(makingsOf(got.seed).sky, "small");
    assert.ok(!seedShown(got.seed).includes("~far"), seedShown(got.seed));
    assert.deepEqual(enteredSeed(got.seed)?.from, { universe: "earth", seed: home.seed.text });
    assert.equal(far.civ, f.ref);
    const world = ALIEN.build(seedFromText(got.seed)),
      g = homePlanet(world).generated;
    // Its star and its own numbers, as the galaxy has them.
    assert.equal(g.star.spectral, s.spectral);
    assert.equal(g.star.temperature, s.temperature);
    assert.equal(g.star.luminosity, s.luminosity);
    assert.equal(g.planet.orbitAu, p.a);
    assert.equal(g.planet.gravity, p.gravity);
    assert.equal(g.planet.meanTemperature, p.temperature);
    assert.equal(g.planet.kind, undefined, "read as a world of rock and water");
    // (The share of its face under sea, as near as its own plates draw it.)
    let low = 0;
    const e = g.fine.tectonics.elevation;
    for (let c = 0; c < e.length; c++) if (e[c]! <= 0) low++;
    assert.ok(Math.abs(low / e.length - far.planet.seas) < 0.05, `${low / e.length}`);
    // Its ground's chemistry and its life's, the ones read.
    assert.deepEqual(worldChemistry(g), f.chem);
    assert.deepEqual(worldLife(g), f.life);
    assert.deepEqual(worldLife(g.fine), f.life);
    // Its people: the body seen (a followed people's as its pages and figures show it from afar), and the look seen.
    assert.deepEqual(g.life.people?.body, f.followed ? civBody(f.followed) : f.body);
    assert.deepEqual(folkFacts(g.fine), folkFactsOf(f, s));
    // (Their figure, drawn from that body and that look: the very figure a town of theirs shows from afar.)
    assert.deepEqual(peopleFigure(g.fine), folkFigure(f, s));
    // And they live: on ground a body of theirs can, with lands to spread over.
    const ctx = populationContext(world),
      peopled = ctx.provinces.all().filter((x) => x.total() > 0);
    assert.equal(ctx.medium, f.body.medium);
    assert.ok(peopled.length > 0, "peopled lands");
    // As many as were read (an estimate both ways: within its order), never more than its lands feed.
    const all = peopled.reduce((a, x) => a + x.total(), 0),
      read = folkPeople(f, 0);
    assert.equal(far.people, read);
    assert.ok(all <= read * 1.1, `${all} people, read as ${read}`);
    if (got.stage === "camps")
      assert.ok(all >= read / 10, `${all} people in camps, read as ${read}`);
    // What they are known to have: a people read past its camps opens holding the crafts of its age, every one its
    // bodies and its world's stuffs allow; where those shut a road, the world says which age.
    const held = loreOf(world).of(g.life.people!.cell).length,
      shut = shutAge(ctx, g.life.people!.cell, far);
    if (got.stage === "camps") assert.equal(held, 0);
    else assert.ok(held > 0 || shut !== null, "crafts held, or a road shut");
    assert.equal(enteredHere(world)!.shut === null, shut === null);
    // It says of itself whom it was made from.
    const here = enteredHere(world)!;
    assert.equal(here.name, f.name);
    assert.equal(here.star, `star:${s.sector}:${s.k}`);
    if (got.stage === "camps") assert.ok(here.arrived);
    // The same seed, the same world.
    assert.equal(
      homePlanet(ALIEN.build(seedFromText(got.seed))).generated.digest,
      g.digest,
      "regenerates from its seed alone",
    );
  });

test("a world entered runs to the age its people were read at, and says when it has", () => {
  // (One read in its villages, towns or cities: a step every peopled world of the measured ones comes to.)
  const early = folks.find((f) => ["villages", "towns", "cities"].includes(folkStage(f, 0)))!;
  assert.ok(early, "a people in its villages, towns or cities");
  const got = ok(plan(early)),
    world = ALIEN.build(seedFromText(got.seed));
  assert.ok(got.usualYears > 0 && got.usualYears <= got.mostYears);
  let year = 0;
  while (!enteredHere(world)!.arrived && year < got.mostYears) world.runTo((year += 10) * YEAR);
  assert.ok(enteredHere(world)!.arrived, `by year ${year}: ${enteredHere(world)!.age}`);
  assert.ok(year <= got.mostYears);
});

test("a smaller grid may be asked for, never a larger than the home world's", () => {
  const usual = ok(plan(camped)),
    wide = ok(enterPlan(home, camped.star, camped.planet, "earth", "standard"));
  assert.equal(usual.size, "small");
  assert.equal(wide.size, "small", "the home world's own, where a larger is asked");
  const big = EARTH.build(seedFromText("first light")),
    f = folksNear(big).find((x) => x.ref === camped.ref)!,
    full = ok(enterPlan(big, f.star, f.planet, "earth")),
    less = ok(enterPlan(big, f.star, f.planet, "earth", "small"));
  assert.equal(full.size, "standard");
  assert.equal(makingsOf(full.seed).size, undefined);
  assert.equal(less.size, "small");
  assert.equal(makingsOf(less.seed).size, "small");
  assert.ok(less.lands < full.lands);
  assert.ok(
    less.fresh.length === full.fresh.length + 1,
    "and it says its lands are reckoned wider",
  );
});

test("asking changes nothing at home, and each people's world is its own", () => {
  const before = JSON.stringify(home.domainHashes());
  const a = ok(plan(camped)),
    b = ok(plan(followed));
  assert.equal(JSON.stringify(home.domainHashes()), before);
  assert.notEqual(seedName(a.seed), seedName(b.seed));
  assert.equal(ok(plan(camped)).seed, a.seed, "the same reading, the same seed");
});

test("where a world cannot be entered, it says why", () => {
  const none = enterPlan(home, "star:999999:0", 0, "earth");
  assert.ok(!none.ok);
  // (A world of ruins: no one to live as. Alien 41's sky holds a people gone before its chronicle opens.)
  const other = ALIEN.build(seedFromText("alien 41 ~size small")),
    gone = folksNear(other).find((f) => folkStage(f, 0) === "ruins")!;
  assert.ok(gone, "a people in ruins");
  const p = enterPlan(other, gone.star, gone.planet, "alien");
  assert.ok(!p.ok && /ruins/.test(p.why), JSON.stringify(p).slice(0, 200));
  // (A world entered is not a place to enter another from.)
  const inner = ALIEN.build(seedFromText(ok(plan(camped)).seed)),
    again = enterPlan(inner, camped.star, camped.planet, "alien");
  assert.ok(!again.ok && /entered/.test(again.why));
});

test("a seed of its own is no world entered", () => {
  assert.equal(enteredHere(home), null);
  assert.equal(farMade("first light"), null);
  assert.equal(enteredSeed("first light ~size small"), null);
});

test("a people read in orbit stands there within its first years, where its world's stuffs build what flies", () => {
  const sky = ALIEN.build(seedFromText("alien 41")),
    f = folksNear(sky).find((x) => folkStage(x, 0) === "orbit" && x.body.medium === "water")!;
  assert.ok(f, "a people of the water in orbit");
  const got = ok(enterPlan(sky, f.star, f.planet, "alien")),
    world = ALIEN.build(seedFromText(got.seed));
  assert.equal(enteredHere(world)!.shut, null);
  let year = 0;
  while (!enteredHere(world)!.arrived && year < got.mostYears) world.runTo((year += 10) * YEAR);
  assert.ok(enteredHere(world)!.arrived, `by year ${year}: ${enteredHere(world)!.age}`);
  // (As many as were read, within the order.)
  const all = populationContext(world)
    .provinces.all()
    .reduce((a, x) => a + x.total(), 0);
  assert.ok(all >= folkPeople(f, 0) / 10 && all <= folkPeople(f, 0) * 10, `${all}`);
});

test("where a world's matter shuts the road to the age read, it says which, and gives its people nothing it cannot", () => {
  // (First light's Laxai: read in orbit by a sight that reads no coal; no land of theirs holds a seam.)
  const sky = EARTH.build(seedFromText("first light")),
    f = folksNear(sky).find((x) => x.followed && folkStage(x, 0) === "orbit")!;
  assert.ok(f, "a followed people in orbit");
  const world = ALIEN.build(seedFromText(ok(enterPlan(sky, f.star, f.planet, "earth")).seed)),
    here = enteredHere(world)!;
  assert.ok(!here.arrived);
  assert.equal(here.shut, "Orbit");
  assert.match(here.shutWhy!, /no fuel/);
  // (And it was said before anyone entered: the plan's reading is the world's own, of the same pure function.)
  const said = ok(enterPlan(sky, f.star, f.planet, "earth")).shut!;
  assert.equal(said.name, "Orbit");
  assert.equal(said.before, "Electricity");
  assert.match(said.why, /no fuel/);
  assert.ok(loreOf(world).get(homePlanet(world).generated.life.people!.cell, "orbital-flight"));
});

test("the reading of a shut road is pure, and the same before entering as on the world entered", () => {
  const sky = ALIEN.build(seedFromText("alien 41"));
  for (const f of folksNear(sky).filter((x) => x.followed && folkStage(x, 0) !== "camps")) {
    const got = ok(enterPlan(sky, f.star, f.planet, "alien")),
      far = farMade(got.seed)!,
      world = ALIEN.build(seedFromText(got.seed)),
      g = homePlanet(world).generated,
      ctx = populationContext(world),
      pure = farShut(g, far),
      there = shutAge(ctx, g.life.people!.cell, far);
    assert.deepEqual(pure, there, f.name);
    assert.deepEqual(pure, farShut(g, far), "the same each time it is asked");
    assert.equal(got.shut?.name ?? null, pure?.name ?? null, f.name);
    // (What the tree opens to them from nothing is what their lands were seated with.)
    assert.deepEqual(farCrafts(g, far.stage), knownAt(ctx, g.life.people!.cell, far), f.name);
    // (Limbs that work no fire: said as limbs, not as matter or fuel.)
    if (pure && !affordancesOf(far.body).fire) assert.equal(pure.why, "limbs", f.name);
  }
});
