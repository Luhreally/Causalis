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
} from "../../src/kernel/index.ts";
import {
  ACT_EVENTS,
  POPULATION_EVENTS,
  actsOf,
  makePopulationWorld,
  populationContext,
} from "../../src/sim/index.ts";
import { spine, why } from "../../src/causal/index.ts";

const seed = seedFromText("first light"),
  HOME = 30210;
const build = () => makePopulationWorld(seed);

test("withheld rain brings dry years that answer, through why, to the god's act", () => {
  const world = build();
  world.runTo(250 * YEAR);
  const act = world.submit("act.rain", { cell: HOME, sign: -1, years: 3 });
  world.runTo(254 * YEAR);
  const droughts = world.events
    .all()
    .filter(
      (e) =>
        e.type === POPULATION_EVENTS.drought.type && e.place === `cell:0:${HOME}` && e.t > act.t,
    );
  assert.equal(droughts.length, 3, "a dry year each year the rain was withheld");
  for (const d of droughts) {
    const path = spine(world, d.id);
    assert.equal(
      world.events.get(path[1]!.ref as Ref)?.type,
      ACT_EVENTS.rain.type,
      "the act is the strongest cause",
    );
    assert.equal(path.at(-1)!.ref, act.id);
    assert.equal(path.at(-1)!.basis, "command");
    assert.match(
      path.at(-1)!.claim,
      /^Your act: you withheld the rain over the steppe at .* for 3 years, year 250/,
    );
  }
  // And whatever famine followed says so too.
  const famine = world.events
    .all()
    .find(
      (e) =>
        e.type === POPULATION_EVENTS.famine.type && e.place === `cell:0:${HOME}` && e.t > act.t,
    );
  if (famine)
    assert.ok(
      spine(world, famine.id).some((n) => n.ref === act.id),
      "the famine goes back to the act",
    );
});

test("a plague sent brings deaths, recorded in the ledgers of those years", () => {
  const quiet = build(),
    struck = build();
  quiet.runTo(250 * YEAR);
  struck.runTo(250 * YEAR);
  struck.submit("act.plague", { cell: HOME, sign: -1, years: 1 });
  quiet.runTo(252 * YEAR);
  struck.runTo(252 * YEAR);
  const deaths = (w: typeof quiet) => populationContext(w).history.deathsIn(HOME, 250);
  assert.ok(
    deaths(struck) > 2.5 * deaths(quiet),
    `${deaths(struck)} died against ${deaths(quiet)}`,
  );
});

test("inspiration grants the next way of life a people lacks, and it answers to the act", () => {
  const world = build();
  world.runTo(60 * YEAR);
  const p = populationContext(world).provinces.get(HOME)!;
  assert.equal(p.knowsCultivation, false);
  const act = world.submit("act.inspire", { cell: HOME, sign: 1, years: 1 });
  world.runTo(61 * YEAR);
  assert.equal(p.knowsCultivation, true);
  const path = spine(world, p.cultivation!);
  assert.equal(path.at(-1)!.ref, act.id);
  assert.match(why(world, p.cultivation!).claim, /^By your hand: you inspired the people of/);
});

test("an act where no one lives, or for too long, is refused", () => {
  const world = build();
  world.runTo(10 * YEAR);
  assert.throws(
    () => world.submit("act.rain", { cell: 0, sign: -1, years: 3 }),
    /no one lives there/,
  );
  assert.throws(
    () => world.submit("act.plague", { cell: HOME, sign: -1, years: 40 }),
    /years must be/,
  );
  assert.throws(
    () => world.submit("act.harvest", { cell: HOME, sign: 2, years: 1 }),
    /sign must be/,
  );
  assert.equal(world.commands.all().length, 0);
});

test("history before an act is the pure run's; after it, a fork that replays and continues bit for bit", () => {
  const pure = build(),
    acted = build();
  pure.runTo(120 * YEAR);
  acted.runTo(80 * YEAR);
  acted.submit("act.harvest", { cell: HOME, sign: 1, years: 5 });
  acted.runTo(120 * YEAR);
  const chain = (w: typeof pure) => w.checkpoints().map((c) => c.chain);
  assert.deepEqual(chain(acted).slice(0, 80), chain(pure).slice(0, 80), "the canonical past");
  assert.notDeepEqual(chain(acted).slice(80), chain(pure).slice(80), "the act forks what follows");
  assert.equal(actsOf(acted).all().length, 1);

  const ruleset = rulesetId(acted, "test"),
    doc = saveWorld(acted, ruleset);
  assert.deepEqual(verifyByReplay(doc, build), { ok: true, problem: null });
  const loaded = loadWorld(doc, build, ruleset).world;
  acted.runTo(140 * YEAR);
  loaded.runTo(140 * YEAR);
  assert.deepEqual(chain(loaded), chain(acted), "a loaded save continues as the unbroken run");
});

test("a drought sent by the god's hand shows up in the why of the famine it causes", () => {
  // Foragers live from what the land gives in the year: five years without rain starve them.
  const world = build();
  world.runTo(120 * YEAR);
  const act = world.submit("act.rain", { cell: HOME, sign: -1, years: 5 });
  world.runTo(126 * YEAR);
  const famines = world.events
    .all()
    .filter(
      (e) =>
        e.type === POPULATION_EVENTS.famine.type && e.place === `cell:0:${HOME}` && e.t > act.t,
    );
  assert.ok(famines.length >= 3, `${famines.length} famines`);
  for (const f of famines) {
    const path = spine(world, f.id);
    assert.equal(world.events.get(path[1]!.ref as Ref)?.type, POPULATION_EVENTS.drought.type);
    assert.equal(world.events.get(path[2]!.ref as Ref)?.type, ACT_EVENTS.rain.type);
    assert.equal(path[3]!.ref, act.id, "the famine ← the dry year ← your withholding of the rain");
  }
});
