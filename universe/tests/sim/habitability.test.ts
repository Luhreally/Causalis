import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { generateHomeWorld } from "../../src/gen/index.ts";
import { CLADES, EARTHLIKE, bodyOf, habitability } from "../../src/rules/index.ts";

const g = generateHomeWorld(seedFromText("first light"), EARTHLIKE),
  bodies = g.system.bodies,
  of = (d: string) => bodies.find((b) => b.designation === d)!,
  swimmer = bodyOf(
    CLADES.find((c) => c.id === "swimmer")!,
    { warmth: 18, rain: 800, gravity: 1, ocean: 0.7 },
    [0.5, 0.5, 0.5],
  );

test("each body asks its own halls: the red world and the great moon lightly, the shrouded world past bearing", () => {
  const red = habitability(of("IV"), null, 1),
    moon = habitability(of("IIIa"), null, 1),
    shrouded = habitability(of("II"), null, 1);
  assert.ok(red.livable && moon.livable);
  assert.ok(!shrouded.livable, "crushing, burning air");
  assert.ok(shrouded.needs.some((n) => n.id === "hulls"));
  assert.ok(
    red.needs.some((n) => n.id === "pressure") && red.needs.some((n) => n.id === "shelter"),
  );
  // No one lives on a giant, or needs to settle the home world.
  assert.ok(!habitability(of("V"), null, 1).livable);
  assert.ok(!habitability(bodies[0]!, null, 1).livable);
});

test("a people of the water needs its halls flooded: icy moons suit it, dry worlds hardly", () => {
  const icy = bodies.find((b) => b.kind === "moon" && b.water === "ice" && b.radiation < 20)!,
    dry = of("I");
  const wet = habitability(icy, swimmer, 1),
    parched = habitability(dry, swimmer, 1);
  assert.ok(wet.needs.some((n) => n.id === "flood"));
  assert.ok(parched.needs.some((n) => n.id === "carried" && n.upkeep >= 5));
  assert.ok(parched.upkeep > habitability(dry, null, 1).upkeep, "harder for them than for apes");
});

test("upkeep is a distance from the settlers' own warmth and air: their kind of world is cheap, ours dear to them", () => {
  // A ground like ours, and one like a hot, dense world's: 15 °C under one bar; 95 °C under 30.
  const ground = (temperature: number, pressure: number) => ({
      kind: "rocky",
      gravity: 1,
      pressure,
      temperature,
      radiation: 1,
      air: "unbreathable",
      water: "seas",
    }),
    mild = ground(15, 1),
    hot = ground(95, 30),
    ours = { gravity: 1, temperature: 15, pressure: 1 },
    theirs = { gravity: 1, temperature: 95, pressure: 30 };
  // Humans: as it was, to the number, whether their home is given by its pull alone or whole.
  for (const g of [mild, hot, ground(-80, 0.01), ground(60, 12), ...bodies])
    assert.deepEqual(
      habitability(g, null, ours),
      habitability(g, null, 1),
      `${g.kind} ${g.temperature}`,
    );
  assert.ok(habitability(hot, null, ours).needs.some((n) => n.id === "cool"));
  assert.ok(habitability(hot, null, ours).needs.some((n) => n.id === "hulls"));
  // A people of the hot, dense world: their own kind of world asks only its air made; ours asks heat and held
  // pressure of them, and costs them more than theirs does, and more than it costs us.
  const home = habitability(hot, null, theirs),
    abroad = habitability(mild, null, theirs);
  assert.deepEqual(
    home.needs.map((n) => n.id),
    ["air"],
  );
  assert.ok(
    abroad.needs.some((n) => n.id === "heat"),
    "no heating on a world 80 °C colder than theirs",
  );
  assert.ok(
    abroad.needs.some((n) => n.id === "pressure"),
    "no held pressure under a thirtieth of their air",
  );
  assert.ok(abroad.upkeep > home.upkeep);
  assert.ok(abroad.upkeep > habitability(mild, null, ours).upkeep);
  // And the further from home, the dearer, smoothly.
  const colder = habitability(ground(-25, 1), null, theirs);
  assert.ok(colder.upkeep > abroad.upkeep);
});
