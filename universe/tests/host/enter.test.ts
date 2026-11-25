import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Rng,
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  seedName,
} from "../../src/kernel/index.ts";
import {
  civBody,
  farCrafts,
  farShut,
  foreignPlanets,
  worldChemistry,
  worldLife,
} from "../../src/gen/index.ts";
import { G, affordancesOf, farMade, makingsOf } from "../../src/rules/index.ts";
import { ALIEN, EARTH, clusterOf } from "../../src/host/planet.ts";
import { enterPlan, enteredHere } from "../../src/host/enter.ts";
import { universeWorld } from "./worlds.ts";
import { folkFacts, peopleFigure } from "../../src/host/folk.ts";
import { folkFactsOf, folkFigure } from "../../src/host/natives.ts";
import { enteredSeed, seedShown, type EnterPlan } from "../../src/bridge/index.ts";
import {
  civilizationsEver,
  civilizationsNear,
  farReadAll,
  farReadNext,
  farReadWorld,
  farShutOn,
  type FarReadStore,
  folkGroundDraws,
  folkPeople,
  folkPeopleAt,
  folkStage,
  folksNear,
  homePlanet,
  knownAt,
  loreOf,
  marketsOf,
  populationContext,
  seatedCells,
  spaceOf,
  shutAge,
  type Folk,
} from "../../src/sim/index.ts";

/** A people's stages in order, ruins first (ranked below the camps: no reading of a fallen people is past anything). */
const STAGE_RANK = [
  "ruins",
  "camps",
  "villages",
  "towns",
  "cities",
  "works",
  "signals",
  "orbit",
  "stars",
] as string[];

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
    // (Cultivation is a land's own, not lore: first light's Laxai, read in their cities, are given it and nothing more, as
    // every road to the age of cities is met by it.)
    const cradle = g.life.people!.cell,
      held =
        loreOf(world).of(cradle).length + (ctx.provinces.get(cradle)?.knowsCultivation ? 1 : 0),
      shut = shutAge(ctx, cradle, far);
    if (got.stage === "camps") assert.equal(held, 0);
    else assert.ok(held > 0 || shut !== null, "crafts held, or a road shut");
    assert.equal(held, knownAt(ctx, cradle, far).length, "what it was seated with");
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
  // (A world of ruins: no one to live as. Since round F a far people's life is read from its own numbers, from the year
  // its climb began, and almost none rose and fell before the chronicle opens: alien 41's sky is entered from the year
  // after the first of its peoples fell, Grevrareth in 874.)
  const sky41 = folksNear(ALIEN.build(seedFromText("alien 41 ~size small")))
      .filter((f) => !f.followed && f.fell !== null && f.fell > 0)
      .sort((a, b) => a.fell! - b.fell! || (a.ref < b.ref ? -1 : 1))[0]!,
    other = universeWorld(ALIEN, "alien 41 ~size small", sky41.fell! + 1),
    gone = folksNear(other).find(
      (f) => f.ref === sky41.ref && folkStage(f, sky41.fell! + 1) === "ruins",
    )!;
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
  // (Until the gap round one of alien 41's sky was a people of the water in orbit; now none of its sky is in orbit, and
  // harrow 348's Qaani are, people of the land.)
  const sky = ALIEN.build(seedFromText("harrow 348")),
    f = folksNear(sky).find((x) => folkStage(x, 0) === "orbit")!;
  assert.ok(f, "a people in orbit");
  const got = ok(enterPlan(sky, f.star, f.planet, "alien")),
    world = ALIEN.build(seedFromText(got.seed));
  assert.equal(enteredHere(world)!.shut, null);
  // What that age left standing, as the chronicle opens: machines in their lands, their world's first flight a fact of
  // the ages before; and no realm of this chronicle has flown yet, so they are not yet said to stand there.
  const stock = () =>
    populationContext(world)
      .provinces.all()
      .reduce((a, x) => a + (marketsOf(world).get(x.cell)?.stock[G.machines] ?? 0), 0);
  assert.ok(stock() > 0, "machines held at the opening");
  assert.ok(spaceOf(world).first.satellite, "a first flight standing");
  assert.equal(spaceOf(world).all().length, 0);
  assert.ok(!enteredHere(world)!.arrived, "not by the crafts alone");
  let year = 0;
  while (!enteredHere(world)!.arrived && year < got.mostYears) world.runTo((year += 10) * YEAR);
  assert.ok(enteredHere(world)!.arrived, `by year ${year}: ${enteredHere(world)!.age}`);
  assert.ok(
    spaceOf(world)
      .all()
      .some((x) => x.satellite),
    "a realm of this chronicle in orbit",
  );
  assert.ok(stock() > 0);
  // (As many as were read, within the order.)
  const all = populationContext(world)
    .provinces.all()
    .reduce((a, x) => a + x.total(), 0);
  assert.ok(all >= folkPeople(f, 0) / 10 && all <= folkPeople(f, 0) * 10, `${all}`);
});

test("where a world's matter shuts the road to an age, the galaxy reads its people no further, and a world made past it says which", () => {
  // (Harrow 348's Qaani: no fuel in their ground, and their rivers, wind and hot ground carry less than their works would
  // ask. Since round E a people without fuel drives its works by another road where its world carries enough, so first
  // light's Laxai, once held at signals for want of coal, come to the stars on their wind; the Qaani do not.)
  // (Since the gap round the Qaani come to the stars, and harrow 348's Toroukon are the ones held: in their camps as the
  // chronicle opens, their own life brings them no further than their cities, and their ground would stop them at signals.)
  const sky = ALIEN.build(seedFromText("harrow 348")),
    f = folksNear(sky).find(
      (x) => x.followed && /shuts the road to Orbit: no fuel/.test(x.shut ?? ""),
    )!;
  assert.ok(f?.followed, "a followed people held short of orbit for want of fuel");
  assert.equal(f.ceiling, "signals");
  for (const year of [0, 500, 5000, 1e6])
    assert.ok(
      STAGE_RANK.indexOf(folkStage(f, year)) <= STAGE_RANK.indexOf("signals"),
      `never in orbit, however long: ${folkStage(f, year)} in ${year}`,
    );
  assert.equal(f.followed!.orbit, Infinity);
  assert.equal(civilizationsNear(sky).find((c) => c.ref === f.ref)!.stars, Infinity);
  // (The years history held of them are still theirs to be named by. Since round F those years are their own life's too,
  // and Toroukon's never came to orbit: no harrow, alien 41 or alien 55 people held short has ever-years past its road.)
  assert.ok(
    civilizationsEver(sky).some((c) => c.ref === f.ref),
    "still among the peoples history holds",
  );
  // The way in agrees: nothing stops them short of where they are read.
  const got = ok(enterPlan(sky, f.star, f.planet, "alien"));
  assert.equal(got.stage, folkStage(f, 0));
  assert.equal(got.shut, null);
  assert.equal(enteredHere(ALIEN.build(seedFromText(got.seed)))!.shut, null);
  // And the path that says so still stands: their world made as the old sight read them, in orbit, says which road
  // is shut and why, and gives its people nothing it cannot.
  const star = clusterOf(sky).find((s) => s.ref === f.star)!,
    past = farReadWorld(
      sky,
      star,
      foreignPlanets(new Rng(sky.seed), star)[f.planet]!,
      {
        name: f.name,
        ref: f.ref,
        followed: true,
        body: civBody(f.followed!) ?? f.body,
        chem: folkGroundDraws(sky, star, f.planet),
      },
      { year: 0, stage: "orbit", people: folkPeopleAt(f, "orbit"), universe: "alien", look: null },
    ),
    world = ALIEN.build(seedFromText(past.seed)),
    here = enteredHere(world)!;
  assert.ok(!here.arrived);
  assert.equal(here.shut, "Orbit");
  assert.match(here.shutWhy!, /no fuel/);
  assert.equal(farShutOn(past.seed, past.made)?.name, "Orbit");
  assert.ok(loreOf(world).get(homePlanet(world).generated.life.people!.cell, "orbital-flight"));
});

test("the way in stops no followed people short of where the galaxy reads it, on four home worlds", () => {
  // (Each followed people past its camps: at every stage up to its ceiling, its world made as the way in makes it
  // shuts no road to it; and at the next stage, where it has a ceiling, the road the galaxy names is the one shut.)
  const STAGES = ["villages", "towns", "cities", "works", "signals", "orbit", "stars"] as const;
  let read = 0,
    held = 0;
  // (Since round E, no followed people of first light's or alien 41's skies is held short: harrow 348's Qaani are, by their
  // own world, past their camps at the chronicle's start; alien 55's Maix, held at cities, are in their camps then.)
  for (const [universe, name, text] of [
    [EARTH, "earth", "first light ~size small"],
    [ALIEN, "alien", "alien 41 ~size small"],
    [ALIEN, "alien", "harrow 348"],
    [ALIEN, "alien", "alien 55"],
  ] as const) {
    const sky = universe.build(seedFromText(text));
    for (const f of folksNear(sky).filter(
      (x) => x.followed && !["camps", "ruins"].includes(folkStage(x, 0)),
    )) {
      const got = ok(enterPlan(sky, f.star, f.planet, name));
      assert.equal(got.shut, null, `${text}: the ${f.name}, read ${got.stageWords}`);
      const star = clusterOf(sky).find((s) => s.ref === f.star)!,
        p = foreignPlanets(new Rng(sky.seed), star)[f.planet]!,
        who = {
          name: f.name,
          ref: f.ref,
          followed: true,
          body: civBody(f.followed!) ?? f.body,
          chem: folkGroundDraws(sky, star, f.planet),
        },
        at = (stage: (typeof STAGES)[number]) => {
          const w = farReadWorld(sky, star, p, who, {
            year: 0,
            stage,
            people: folkPeopleAt(f, stage),
            universe: name,
            look: null,
          });
          return farShutOn(w.seed, w.made);
        },
        top = STAGES.indexOf(f.ceiling as (typeof STAGES)[number]);
      assert.ok(top >= 0, `${f.name}: a ceiling past its camps (${f.ceiling})`);
      assert.equal(at(STAGES[top]!), null, `${text}: the ${f.name} at its ceiling, ${f.ceiling}`);
      // (No reading of history's years finds them past it. Since round F a people steps by its own life, which may stop short
      // of what its world allows, as first light's Laxai stop at their cities, or fall to ruins.)
      for (const year of [0, 500, 5000, 1e6])
        assert.ok(
          STAGE_RANK.indexOf(folkStage(f, year)) <= top + 2,
          `${f.name} in ${year}: ${folkStage(f, year)} past ${f.ceiling}`,
        );
      if (f.shut) {
        held++;
        const next = at(STAGES[top + 1]!);
        assert.ok(
          next,
          `${text}: the ${f.name} past ${f.ceiling}: nothing shut, though the galaxy says so`,
        );
        assert.ok(
          f.shut.includes(`the road to ${next.name}`),
          `${f.name}: ${f.shut} / ${next.name}`,
        );
        assert.equal(f.followed!.stars, Infinity);
      } else assert.equal(f.ceiling, "stars");
      read++;
    }
  }
  assert.ok(read >= 8, `${read} followed peoples read`);
  assert.ok(held >= 1, `${held} held by their own worlds`);
});

test("a followed people is read as no more than its own world holds, seated as the way in seats it", () => {
  // (The far sight's count of a people is a guess from its stage; a followed people's world is made whole, and it holds
  // no more than its lands feed at their part, sim/population/world.ts seatsAtMost. Laxai: some 878 million guessed.)
  // (Harrow 348's Toroukon, read in their cities, would be some 1.5 million; their world holds 49. None of first light's is
  // held so since the gap round.)
  let held = 0;
  const harrow = folksNear(ALIEN.build(seedFromText("harrow 348")));
  for (const f of [...folks, ...harrow].filter((x) => x.followed)) {
    assert.ok(f.holds !== null && f.holds > 0, `${f.name}: what its world holds`);
    for (const year of [0, 500, 1050, 1e6]) {
      const read = folkPeople(f, year);
      assert.ok(read <= f.holds!, `${f.name} in ${year}: read ${read}, its world holds ${f.holds}`);
      if (read < folkPeopleAt(f, folkStage(f, year))) held++;
    }
  }
  assert.ok(held > 0, "no followed people read as more than its world holds");
  // (A people history does not follow is read from afar alone.)
  assert.ok(folks.some((f) => !f.followed && f.holds === null));
});

test("the reading of a shut road is pure, and the same before entering as on the world entered", () => {
  const sky = ALIEN.build(seedFromText("alien 41"));
  // (Not one in ruins, whom no one can live as: "where a world cannot be entered" above.)
  for (const f of folksNear(sky).filter(
    (x) => x.followed && !["camps", "ruins"].includes(folkStage(x, 0)),
  )) {
    const got = ok(enterPlan(sky, f.star, f.planet, "alien")),
      far = farMade(got.seed)!,
      world = ALIEN.build(seedFromText(got.seed)),
      g = homePlanet(world).generated,
      ctx = populationContext(world),
      pure = farShut(g, far, undefined, seatedCells(g, got.seed)),
      there = shutAge(ctx, g.life.people!.cell, far);
    assert.deepEqual(pure, there, f.name);
    assert.deepEqual(
      pure,
      farShut(g, far, undefined, seatedCells(g, got.seed)),
      "the same each time it is asked",
    );
    assert.equal(got.shut?.name ?? null, pure?.name ?? null, f.name);
    // (What the tree opens to them from nothing is what their lands were seated with.)
    assert.deepEqual(farCrafts(g, far.stage), knownAt(ctx, g.life.people!.cell, far), f.name);
    // (Limbs that work no fire: said as limbs, not as matter or fuel.)
    if (pure && !affordancesOf(far.body).fire) assert.equal(pure.why, "limbs", f.name);
  }
});

test("what was read of the followed peoples' own worlds is kept beside the world: saved, loaded, and no part of its hash", () => {
  const text = "first light ~size small",
    read = EARTH.build(seedFromText(text)),
    unread = EARTH.build(seedFromText(text)),
    ruleset = rulesetId(read, "test");
  assert.equal(farReadNext(read), true, "a people's world to read");
  farReadAll(read);
  assert.equal(farReadNext(read), false, "all read");
  // Reading moves nothing of history: the same hashes as a world that has read none of them.
  assert.deepEqual(read.domainHashes(), unread.domainHashes());
  const store = read.store<FarReadStore>("readings.far"),
    followed = folksNear(read).filter((f) => f.followed);
  assert.ok(followed.length >= 3);
  for (const f of followed) assert.equal(store.of(f.ref)?.ceiling, f.ceiling, f.name);
  // A save carries them, and a world loaded from it holds them as they were.
  const loaded = loadWorld(saveWorld(read, ruleset), (s) => EARTH.build(s), ruleset).world,
    kept = loaded.store<FarReadStore>("readings.far");
  for (const f of followed) assert.deepEqual(kept.of(f.ref), store.of(f.ref), f.name);
  // A save made before there was such a reading loads, and reads them again.
  const doc = saveWorld(read, ruleset),
    { ["readings.far"]: _gone, ...stores } = doc.stores,
    old = loadWorld({ ...doc, stores }, (s) => EARTH.build(s), ruleset).world;
  void _gone;
  assert.equal(
    folksNear(old).find((f) => f.ref === followed[0]!.ref)!.ceiling,
    followed[0]!.ceiling,
  );
});
