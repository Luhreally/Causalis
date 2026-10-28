import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, saveWorld, loadWorld, rulesetId } from "../../src/kernel/index.ts";
import { makePopulationWorld, warsOf } from "../../src/sim/index.ts";

test("a save with legacy battles keeps its history and resumes with cohesion combat", () => {
  const seed = seedFromText("first light"),
    build = () => makePopulationWorld(seed, { start: "spread" }),
    world = build();
  world.runTo(80 * YEAR);
  const wars = warsOf(world).all();
  assert.ok(wars.some((w) => w.battles.length));
  // The optional record did not exist in older saves. Keep exactly that historical shape.
  for (const w of wars)
    w.battles = w.battles.map((b) => {
      const { combat, ...old } = b;
      void combat;
      return old;
    });
  const history = structuredClone(wars.flatMap((w) => w.battles)),
    events = world.events.all().length,
    saved = saveWorld(world, rulesetId(world, "legacy-war")),
    loaded = loadWorld(saved, build, rulesetId(world, "cohesion-war"), {
      allowRulesetChange: true,
    }).world;
  assert.deepEqual(
    warsOf(loaded)
      .all()
      .flatMap((w) => w.battles),
    history,
  );
  assert.equal(loaded.events.all().length, events);
  for (const w of [world, loaded]) w.runTo(85 * YEAR);
  assert.deepEqual(loaded.domainHashes(), world.domainHashes());
  const future = warsOf(loaded)
    .all()
    .flatMap((w) => w.battles)
    .filter((b) => b.year >= 80);
  assert.ok(future.length > 0 && future.every((b) => b.combat?.model === 2));
});
