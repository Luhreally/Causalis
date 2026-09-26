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
