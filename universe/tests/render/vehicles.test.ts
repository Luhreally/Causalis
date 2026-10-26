// An armoured car's parts as drawn (Phase 53 M220): the geometry alone, no GPU needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { VehicleNow } from "../../src/view/index.ts";
import { CAR, carParts, type CarPart } from "../../src/render/vehicles.ts";

const car = (over: Partial<VehicleNow> = {}): VehicleNow => ({
  id: 1,
  side: 0,
  x: 0,
  y: 0,
  z: 0,
  yaw: Math.PI / 2,
  turret: 0,
  recoil: 0,
  knocked: 0,
  burning: 0,
  ...over,
});

const of = (parts: readonly CarPart[], kind: CarPart["kind"]) =>
  parts.filter((p) => p.kind === kind);
const near = (a: number, b: number, what = "") =>
  assert.ok(Math.abs(a - b) < 1e-9, `${what} ${a} ≈ ${b}`);

test("a running car facing +x: hull centred on it, wheels at its four corners, turret above, gun ahead along +x", () => {
  const parts = carParts(car({ x: 3, z: -2 }), 1, 1),
    [hull] = of(parts, "hull"),
    [turret] = of(parts, "turret"),
    [gun] = of(parts, "gun"),
    wheels = of(parts, "wheel");
  assert.equal(parts.length, 8);
  near(hull!.x, 3, "hull x");
  near(hull!.z, -2, "hull z");
  assert.ok(hull!.y > 0, "the hull stands above the ground");
  // Four wheels, two either side of the hull's length and two either side across it.
  assert.equal(wheels.length, 4);
  for (const w of wheels) {
    const along = w.x - 3,
      across = w.z + 2;
    assert.ok(Math.abs(along) > CAR.long / 4 && Math.abs(along) < CAR.long / 2, "wheel along");
    near(Math.abs(across), CAR.wide / 2, "wheel across");
  }
  const corners = new Set(wheels.map((w) => `${Math.sign(w.x - 3)}${Math.sign(w.z + 2)}`));
  assert.equal(corners.size, 4, "one wheel at each corner");
  // The turret above the hull, the gun out of its front along +x, level with the turret.
  near(turret!.x, 3, "turret x");
  near(turret!.z, -2, "turret z");
  assert.ok(turret!.y > hull!.y, "the turret is above the hull");
  assert.ok(gun!.x > turret!.x, "the gun is ahead of the turret along +x");
  near(gun!.z, turret!.z, "gun across");
  near(gun!.y, turret!.y, "gun level");
});

test("the turret turned by a right angle moves the gun to the side, and recoil draws it back toward the turret", () => {
  const level = carParts(car(), 1, 1),
    [t0] = of(level, "turret"),
    [g0] = of(level, "gun"),
    turned = carParts(car({ turret: Math.PI / 2 }), 1, 1),
    [t1] = of(turned, "turret"),
    [g1] = of(turned, "gun"),
    kicked = carParts(car({ turret: Math.PI / 2, recoil: 1 }), 1, 1),
    [g2] = of(kicked, "gun");
  // Facing +x, the turret turned a right angle looks across the car: the gun is off to the side.
  near(g1!.x - t1!.x, 0, "gun along x");
  assert.ok(Math.abs(g1!.z - t1!.z) > 1, "the gun is off to the side");
  // With the gun drawn back, it sits nearer its turret, still out of the turret's front.
  assert.ok(Math.abs(g2!.z - t1!.z) < Math.abs(g1!.z - t1!.z), "recoil brings the gun back");
  assert.ok(Math.abs(g2!.z - t1!.z) > 0, "and it stays out of the turret");
  assert.ok(g0!.x > t0!.x, "unturned, the gun is ahead of the turret");
});

test("a wreck is tipped and sunk, and its turret is tipped askew", () => {
  const running = carParts(car(), 1, 1),
    wreck = carParts(car({ knocked: 1 }), 1, 1);
  assert.equal(of(running, "turret")[0]!.pitch, 0);
  assert.notEqual(of(wreck, "turret")[0]!.pitch, 0);
  assert.notEqual(of(wreck, "hull")[0]!.pitch, 0);
  assert.ok(of(wreck, "hull")[0]!.y < of(running, "hull")[0]!.y, "the hull sinks");
});

test("every size is positive, and scales with the metre", () => {
  const scene = car({ turret: 0.7, recoil: 0.5, knocked: 0.6 }),
    one = carParts(scene, 1, 1),
    two = carParts(scene, 2, 1);
  assert.equal(one.length, two.length);
  one.forEach((p, i) => {
    for (const k of ["sx", "sy", "sz"] as const) {
      assert.ok(p[k] > 0, `${p.kind} ${k} is positive`);
      near(two[i]![k], 2 * p[k], `${p.kind} ${k} doubles with the metre`);
    }
  });
});

test("positions are the field's metres times M", () => {
  const hull = carParts(car({ x: 30, z: -20 }), 1, 0.1)[0]!;
  near(hull.x, 3, "hull x");
  near(hull.z, -2, "hull z");
});
