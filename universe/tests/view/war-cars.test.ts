import { test } from "node:test";
import assert from "node:assert/strict";
import type { HostKinds, WarsMap } from "../../src/bridge/index.ts";
import { sphereGrid } from "../../src/kernel/index.ts";
import { MARCH, armoured, warPaths, warTokens } from "../../src/view/index.ts";

const grid = sphereGrid(16);

/** A world half land (the northern half) and half sea. */
const elevation = Float32Array.from({ length: grid.count }, (_, c) =>
  grid.positions[c * 3 + 1]! > 0 ? 400 : -2000,
);
const cellNear = (x: number, y: number, z: number) => {
  let best = 0,
    bestDot = -Infinity;
  for (let c = 0; c < grid.count; c++) {
    const d =
      grid.positions[c * 3]! * x + grid.positions[c * 3 + 1]! * y + grid.positions[c * 3 + 2]! * z;
    if (d > bestDot) {
      bestDot = d;
      best = c;
    }
  }
  return best;
};

const red = [0.8, 0.2, 0.2] as const,
  blue = [0.2, 0.3, 0.8] as const,
  green = [0.2, 0.7, 0.3] as const;
const armouredHost: HostKinds = { arm: "automatic", guard: "helmet", mount: "armoured" };
const cavalryHost: HostKinds = { arm: "rifle", guard: "plate", mount: "cavalry" };
const bowHost: HostKinds = { arm: "bow", guard: "leather", mount: "horse" };

/** The Reds march from the north upon the Blues, each side fielding 80,000 in the given host. */
const warWith = (attacker: HostKinds, defender: HostKinds = bowHost): WarsMap => ({
  year: 300,
  garrisons: [],
  wars: [
    {
      ref: "war:0:1",
      attacker: {
        ref: "pol:0:1",
        name: "the Reds",
        color: red,
        fields: 80000,
        arms: null,
        host: attacker,
      },
      defender: {
        ref: "pol:0:2",
        name: "the Blues",
        color: blue,
        fields: 80000,
        arms: null,
        host: defender,
      },
      from: cellNear(0.7, 0.7, 0),
      to: cellNear(-0.7, 0.7, 0.05),
      declared: 298,
      ended: null,
      siege: null,
      battles: [],
    },
  ],
});

test("an armoured host's men come among them in cars on the globe: every fourth, counted rank by rank, never with a banner or as the lead (Phase 53)", () => {
  assert.equal(armoured(armouredHost), true);
  assert.equal(armoured(cavalryHost), false);
  assert.equal(armoured(null), false);
  const paths = warPaths(warWith(armouredHost), grid, elevation),
    path = paths.paths[0]!;
  assert.equal(path.armoured, true);
  assert.equal(path.mounted, false, "on foot");
  assert.equal(path.foeArmoured, false);
  // The attacker's column, in the order its men are made: the fourth, eighth… (index 2, 6, …) are cars.
  const tokens = warTokens(paths, MARCH * 0.5),
    column = tokens.filter((t) => t.attacker),
    cars = column.filter((t) => t.car);
  assert.ok(cars.length >= 2, `${cars.length} cars among ${column.length} men`);
  column.forEach((t, i) => assert.equal(t.car === true, i % 4 === 2, `man ${i}`));
  for (const t of cars)
    assert.ok(!t.banner && !t.lead, "a car bears no banner and leads no column");
  assert.ok(column.every((t) => t.armoured && !t.mounted));
  // The same rule along a way watched unfolding (its host as far along as its clock says).
  const watched = warTokens(paths, 3, new Map([["war:0:1", 0.5]])).filter((t) => t.attacker);
  watched.forEach((t, i) => assert.equal(t.car === true, i % 4 === 2, `watched man ${i}`));
});

test("a cavalry host has no cars: no figure carries a car field, and it rides as before (Phase 53)", () => {
  const paths = warPaths(warWith(cavalryHost), grid, elevation),
    tokens = warTokens(paths, MARCH * 0.5);
  assert.equal(paths.paths[0]!.armoured, false);
  assert.equal(paths.paths[0]!.mounted, true);
  assert.ok(
    tokens.every((t) => !("car" in t)),
    "no car field on any figure",
  );
  assert.ok(tokens.filter((t) => t.attacker).every((t) => t.mounted && !t.armoured));
});

test("the defenders' host and a realm's garrison carry it too, and the same rule holds for their cars (Phase 53)", () => {
  const held = warPaths(warWith(bowHost, armouredHost), grid, elevation),
    foe = warTokens(held, MARCH * 0.5).filter((t) => !t.attacker);
  assert.equal(held.paths[0]!.foeArmoured, true);
  assert.equal(held.paths[0]!.foeMounted, false);
  assert.equal(held.paths[0]!.armoured, false);
  assert.ok(
    foe.some((t) => t.car),
    "defenders' cars",
  );
  foe.forEach((t, i) => assert.equal(t.car === true, i % 4 === 2, `defender ${i}`));
  const garrisoned = warPaths(
    {
      ...warWith(bowHost),
      garrisons: [
        {
          realm: "pol:0:9",
          name: "the Greens",
          color: green,
          spot: cellNear(0.5, 0.7, 0.5),
          fields: 30000,
          host: armouredHost,
        },
      ],
    },
    grid,
    elevation,
  );
  assert.equal(garrisoned.garrisons[0]!.armoured, true);
  assert.equal(garrisoned.garrisons[0]!.mounted, false);
});
