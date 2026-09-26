import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type Ref,
  type World,
} from "../../src/kernel/index.ts";
import { makePopulationWorld, populationContext } from "../../src/sim/index.ts";
import {
  deepen,
  meetHousehold,
  observer,
  setWatch,
  tidings,
  watches,
} from "../../src/causal/index.ts";
import { cradleCell } from "../cradle.ts";

const seed = seedFromText("first light"),
  HOME = cradleCell("first light");
const build = () => {
  const w = makePopulationWorld(seed);
  observer(w);
  return w;
};
const LAND = `cell:0:${HOME}` as Ref;

test("following a land tells what matters there, once, and changes nothing", () => {
  const quiet = build(),
    watched = build();
  quiet.runTo(100 * YEAR);
  watched.runTo(100 * YEAR);
  assert.ok(setWatch(watched, LAND, true));
  assert.equal(setWatch(watched, LAND, true), false, "followed once");
  assert.deepEqual(
    watches(watched).map((w) => w.ref),
    [LAND],
  );
  const told = [];
  for (let year = 101; year <= 260; year++) {
    watched.runTo(year * YEAR);
    // Each piece of news as it is told (history may later let an ordinary one go).
    for (const t of tidings(watched)) {
      const e = watched.events.get(t.ref)!;
      assert.equal(e.place, LAND, "news of the land followed");
      assert.ok(e.importance >= 4 || e.type === "belief.converted", `${e.type} matters`);
      assert.ok(e.t > 100 * YEAR, "only news from after it was followed");
      told.push(t);
    }
  }
  assert.ok(told.length >= 5, `${told.length} tidings`);
  assert.equal(new Set(told.map((t) => t.ref)).size, told.length, "each told once");
  assert.deepEqual(tidings(watched), [], "nothing new until time passes");
  quiet.runTo(260 * YEAR);
  assert.deepEqual(watched.domainHashes(), quiet.domainHashes(), "following changes nothing");
});

test("following a person met tells what they lived through and their death", () => {
  const world = build();
  world.runTo(240 * YEAR);
  const v = populationContext(world).settlements.inProvince(HOME)[0]!,
    hh = meetHousehold(world, HOME, v.ref),
    ledger = observer(world),
    eldest = hh.members.map((r) => ledger.person(r)!).sort((a, b) => a.birthYear - b.birthYear)[0]!;
  const before = deepen(world, eldest).life!.length;
  assert.ok(setWatch(world, eldest.ref, true));
  const told = [];
  for (let year = 241; year <= 310 && eldest.alive; year++) {
    world.runTo(year * YEAR);
    told.push(...tidings(world));
  }
  world.runTo(world.now + YEAR);
  told.push(...tidings(world));
  const name = `${eldest.name} ${eldest.surname}`;
  assert.ok(told.length >= 1, "something to tell");
  for (const t of told) assert.ok(t.claim.startsWith(name), t.claim);
  if (!eldest.alive)
    assert.ok(
      told.some((t) => t.claim.includes(`died in year ${eldest.diedYear}`)),
      "their death is told",
    );
  // Their life is carried on as time passes, keeping what was told before.
  const life = deepen(world, eldest).life!;
  assert.ok(life.length >= before, "nothing they lived through is lost");
  assert.equal(
    new Set(told.map((t) => `${t.year}:${t.claim}`)).size,
    told.length,
    "each year told once",
  );
});

test("what is followed is kept in the save, and the ledger never touches history", () => {
  const world = build();
  world.runTo(240 * YEAR);
  setWatch(world, LAND, true);
  const v = populationContext(world).settlements.inProvince(HOME)[0]!;
  setWatch(world, v.ref, true);
  world.runTo(260 * YEAR);
  const ruleset = rulesetId(world, "test"),
    doc = saveWorld(world, ruleset),
    loaded: World = loadWorld(doc, build, ruleset).world;
  assert.deepEqual(watches(loaded), watches(world));
  const news = tidings(world);
  assert.ok(news.length >= 1, "twenty years of news");
  assert.deepEqual(tidings(loaded), news, "the same news from the same place");
  assert.ok(setWatch(loaded, v.ref, false));
  assert.deepEqual(
    watches(loaded).map((w) => w.ref),
    [LAND],
  );
});
