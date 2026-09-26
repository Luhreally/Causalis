import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { generateHomeWorld, positionAt } from "../../src/gen/index.ts";
import { EARTHLIKE, OPEN } from "../../src/rules/index.ts";

test("the Earth seed's star has a system like the Sun's", () => {
  const g = generateHomeWorld(seedFromText("first light"), EARTHLIKE),
    sys = g.system,
    planets = sys.bodies.filter((b) => b.kind !== "moon"),
    byPlace = [...planets].sort((a, b) => a.orbit.a - b.orbit.a);
  assert.equal(planets.length, 8);
  // The home world third from the star, its own numbers as made.
  const home = sys.bodies[0]!;
  assert.equal(home.kind, "home");
  assert.equal(byPlace.indexOf(home), 2);
  assert.equal(home.designation, "III");
  assert.equal(home.orbit.a, g.planet.orbitAu);
  assert.equal(home.gravity, g.planet.gravity);
  // A shrouded hot world inside it; a small cold red one outside, with a thin air and ice.
  const second = byPlace[1]!,
    fourth = byPlace[3]!;
  assert.ok(second.temperature > 400 && second.pressure > 30, "a shrouded hot world");
  assert.ok(fourth.temperature < -30 && fourth.pressure < 0.05 && fourth.water === "ice");
  // Giants beyond the frost line, rock inside it.
  for (const p of byPlace)
    if (p.kind === "rocky") assert.ok(p.orbit.a < sys.frostLine);
    else if (p.kind !== "home") assert.ok(p.orbit.a > sys.frostLine);
  // A great moon about the home world, going round in about a month, airless.
  const moon = sys.bodies.find((b) => b.orbit.around === home.ref)!;
  assert.ok(moon.orbit.periodDays > 24 && moon.orbit.periodDays < 31, `${moon.orbit.periodDays}`);
  assert.equal(moon.air, "none");
  assert.ok(moon.radiation > 10, "no air to stop the star's radiation");
});

test("every body keeps the textbook laws: Kepler's third, escape speed, air by pull", () => {
  for (const name of ["first light", "alien 3", "alien 55", "alien 70"]) {
    const g = generateHomeWorld(seedFromText(name), name === "first light" ? EARTHLIKE : OPEN);
    for (const b of g.system.bodies) {
      assert.ok(Math.abs(b.escape - 11.19 * Math.sqrt(b.mass / b.radius)) < 1e-9);
      assert.ok(Math.abs(b.gravity - b.mass / (b.radius * b.radius)) < 1e-9);
      if (b.kind !== "moon") {
        // P² = a³ / M★ (years, AU, solar masses).
        const years = b.orbit.periodDays / 365.25;
        assert.ok(
          Math.abs((years * years * g.star.mass) / b.orbit.a ** 3 - 1) < 1e-6 || b.kind === "home",
          `${name} ${b.designation}`,
        );
      }
      // A world too weak to hold air at its warmth has next to none.
      if (b.kind === "rocky" || b.kind === "moon")
        if (b.escape < 1) assert.ok(b.pressure < 0.001, `${name} ${b.designation}`);
    }
    // Rock inside the frost line, gas and ice giants beyond it.
    for (const b of g.system.bodies)
      if (b.kind === "giant" || b.kind === "ice giant") assert.ok(b.orbit.a > g.system.frostLine);
  }
});

test("positions are Kepler's: each world comes round again after its year, between its nearest and farthest", () => {
  const g = generateHomeWorld(seedFromText("alien 55"), OPEN),
    sys = g.system;
  sys.bodies.forEach((b, i) => {
    if (b.kind === "moon") return;
    const period = b.orbit.periodDays * 86_400;
    for (const t of [0, 1e7, 3.3e8]) {
      const p = positionAt(sys, i, t),
        q = positionAt(sys, i, t + period),
        r = Math.hypot(p.x, p.y);
      assert.ok(
        Math.hypot(p.x - q.x, p.y - q.y) < 1e-6 * b.orbit.a,
        `${b.designation} comes round`,
      );
      assert.ok(
        r >= b.orbit.a * (1 - b.orbit.e) - 1e-9 && r <= b.orbit.a * (1 + b.orbit.e) + 1e-9,
        `${b.designation} at ${r} AU`,
      );
    }
  });
  // A moon stays close by its planet.
  const moon = sys.bodies.findIndex((b) => b.kind === "moon"),
    parent = sys.bodies.findIndex((b) => b.ref === sys.bodies[moon]!.orbit.around),
    m = positionAt(sys, moon, 5e6),
    p = positionAt(sys, parent, 5e6);
  assert.ok(Math.hypot(m.x - p.x, m.y - p.y) < 0.1);
});

test("the system is the seed's own, and open worlds' systems differ", () => {
  const a = generateHomeWorld(seedFromText("alien 9"), OPEN).system,
    b = generateHomeWorld(seedFromText("alien 9"), OPEN).system,
    c = generateHomeWorld(seedFromText("alien 10"), OPEN).system;
  assert.deepEqual(a, b);
  assert.notDeepEqual(
    a.bodies.map((x) => x.orbit.a),
    c.bodies.map((x) => x.orbit.a),
  );
});
