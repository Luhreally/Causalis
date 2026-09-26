import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  verifyByReplay,
  type World,
} from "../../src/kernel/index.ts";
import { COLS, ROWS, handOf, makePopulationWorld, populationContext } from "../../src/sim/index.ts";
import { cradleCell } from "../cradle.ts";

const seed = seedFromText("first light"),
  HOME = cradleCell("first light");
const build = () => makePopulationWorld(seed);

function firstVillage(world: World) {
  return populationContext(world).settlements.inProvince(HOME)[0]!;
}

const domain = (w: World, name: string) => w.domainHashes().find(([d]) => d === name)?.[1];

test("laying and lifting the hand with no time between leaves every aggregate exactly as it was", () => {
  const quiet = build(),
    touched = build();
  quiet.runTo(245 * YEAR);
  touched.runTo(245 * YEAR);
  const v = firstVillage(touched);
  touched.submit("hand.lay", { village: v.ref });
  touched.runTo(245 * YEAR + 1);
  const w = handOf(touched).resting!;
  assert.equal(w.agents.length, v.population, "everyone in the village, one by one");
  touched.submit("hand.lift", {});
  touched.runTo(245 * YEAR + 2);
  quiet.runTo(245 * YEAR + 2);
  assert.equal(handOf(touched).resting, null);
  for (const d of ["population", "economy", "planet"])
    assert.equal(domain(touched, d), domain(quiet, d), `${d} is as it was`);
});

test("while the hand rests, its people are born and die one by one, inside the counts", () => {
  const world = build();
  world.runTo(240 * YEAR);
  const v = firstVillage(world);
  world.submit("hand.lay", { village: v.ref });
  world.runTo(240 * YEAR + 1);
  const ctx = populationContext(world),
    hand = handOf(world);
  let born = 0,
    died = 0;
  for (let year = 241; year <= 270; year++) {
    const before = new Set(hand.resting!.agents.map((a) => a.id));
    world.runTo(year * YEAR);
    const now = hand.resting!.agents;
    born += now.filter((a) => !before.has(a.id)).length;
    died += [...before].filter((id) => !now.some((a) => a.id === id)).length;
    // The window's people are always among the counted.
    const within = hand.composition(HOME, year, ctx.life)!,
      p = ctx.provinces.get(HOME)!;
    for (let r = 0; r < ROWS; r++)
      for (let o = 0; o < COLS; o++)
        assert.ok(within[r * COLS + o]! <= p.counts.get(r, o), `year ${year} row ${r} work ${o}`);
    assert.equal(
      ctx.settlements.get(v.ref)!.population,
      now.length,
      "the village holds exactly its people",
    );
  }
  assert.ok(born > 10 && died > 10, `${born} born and ${died} died under the hand`);
  assert.ok(
    hand.resting!.agents.some((a) => a.occupation !== 0 && world.now / YEAR - a.birthYear < 30),
    "children grew up and took up work",
  );
});

test("one hand at a time; lifting needs a hand to lift", () => {
  const world = build();
  world.runTo(240 * YEAR);
  assert.throws(() => world.submit("hand.lift", {}), /rests on no village/);
  const [a, b] = populationContext(world).settlements.inProvince(HOME);
  world.submit("hand.lay", { village: a!.ref });
  world.runTo(240 * YEAR + 1);
  assert.throws(() => world.submit("hand.lay", { village: b!.ref }), /already rests/);
});

test("a world with a hand laid and lifted replays, and its save continues, bit for bit", () => {
  const world = build();
  world.runTo(238 * YEAR);
  world.submit("hand.lay", { village: firstVillage(world).ref });
  world.runTo(250 * YEAR);
  world.submit("hand.lift", {});
  world.runTo(252 * YEAR);
  world.submit("hand.lay", { village: firstVillage(world).ref });
  world.runTo(255 * YEAR);
  const ruleset = rulesetId(world, "test"),
    doc = saveWorld(world, ruleset);
  assert.deepEqual(verifyByReplay(doc, build), { ok: true, problem: null });
  const loaded = loadWorld(doc, build, ruleset).world;
  world.runTo(262 * YEAR);
  loaded.runTo(262 * YEAR);
  assert.deepEqual(
    loaded.checkpoints().map((c) => c.chain),
    world.checkpoints().map((c) => c.chain),
  );
});
