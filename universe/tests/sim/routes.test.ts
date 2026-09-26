import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { generateHomeWorld } from "../../src/gen/index.ts";
import {
  EARTHLIKE,
  delivered,
  hohmann,
  routeTo,
  toOrbit,
  type Bodylike,
} from "../../src/rules/index.ts";

const g = generateHomeWorld(seedFromText("first light"), EARTHLIKE),
  bodies: Bodylike[] = g.system.bodies.map((b) => ({
    around: g.system.bodies.findIndex((p) => p.ref === b.orbit.around),
    a: b.orbit.a,
    periodDays: b.orbit.periodDays,
    mass: b.mass,
    radius: b.radius,
    pressure: b.pressure,
  })),
  byName = (d: string) => g.system.bodies.findIndex((b) => b.designation === d);

test("Hohmann's transfer: the home world to the cold red world as the textbooks give it", () => {
  // About the Sun, 1 AU to 1.52 AU: about 2.9 and 2.6 km/s, some 259 days.
  const h = hohmann(1.327e11, 1.496e8, 1.524 * 1.496e8);
  assert.ok(Math.abs(h.v1 - 2.94) < 0.05 && Math.abs(h.v2 - 2.65) < 0.05, `${h.v1} ${h.v2}`);
  assert.ok(Math.abs(h.days - 259) < 3, `${h.days}`);
});

test("the ways to the other bodies: the great moon days away, always open; the red world months away, every two years", () => {
  const moon = routeTo(bodies, byName("IIIa"), g.star.mass),
    red = routeTo(bodies, byName("IV"), g.star.mass);
  assert.ok(moon.speed > 4.5 && moon.speed < 6.5 && moon.days < 7 && moon.window === 0);
  assert.ok(red.days > 200 && red.days < 320, `${red.days}`);
  assert.ok(red.window > 700 && red.window < 900, `${red.window}`);
  assert.ok(red.depart > 3 && red.depart < 4.2, `${red.depart}`);
});

test("which bodies a drive reaches: oil engines the great moon, not the giants' moons; water parted by current both", () => {
  const up = toOrbit(g.system.bodies[0]!).total,
    oil = (id: string) => ["rocketry", "engines", "steel"].includes(id),
    parted = (id: string) =>
      ["rocketry", "engines", "steel", "electronics", "guidance"].includes(id),
    far = routeTo(bodies, byName("Vc"), g.star.mass).speed,
    near = routeTo(bodies, byName("IIIa"), g.star.mass).speed;
  assert.ok(delivered(oil, up, near));
  assert.equal(delivered(oil, up, far), null);
  const there = delivered(parted, up, far)!;
  assert.ok(there && there.cost > delivered(parted, up, near)!.cost);
});
