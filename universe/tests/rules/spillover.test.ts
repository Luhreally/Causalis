// Where sicknesses arise (2026-11-23): how near kin a beast is to a people, read off both bodies; a land's hazard, force by
// force, from its herds, its hunters and the wild, its warm standing water, and the share of crossings that go on in its crowds
// and along its roads; and the force a rising is named for.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARISE,
  ariseForces,
  bodyKin,
  leadingForce,
  lifePace,
  type Exposure,
  type KinBody,
} from "../../src/rules/spillover.ts";

const APE: KinBody = { warm: true, symmetry: "bilateral", skin: "skin", water: false },
  CATTLE: KinBody = { warm: true, symmetry: "bilateral", skin: "fur", water: false },
  FOWL: KinBody = { warm: true, symmetry: "bilateral", skin: "feathers", water: false },
  FISH: KinBody = { warm: false, symmetry: "bilateral", skin: "scales", water: true },
  SWIMMER: KinBody = { warm: false, symmetry: "radial", skin: "skin", water: true };

/** A herding land of 30,000 in a warm, wet valley, with a town of 8,000 on four roads. */
const LAND: Exposure = {
  people: 30000,
  town: 8000,
  linked: 20000,
  roads: 4,
  herds: true,
  herdKin: 1,
  hunt: ARISE.hunt,
  wild: 1,
  kinds: 6,
  wildKin: 1,
  warmth: 24,
  rain: 1500,
  standing: 1,
  inWater: false,
  clean: false,
};

test("kin: a people and their cattle are of one kind of body; fowl less, a fish least; a cold swimmer nearer the fish", () => {
  assert.equal(bodyKin(APE, CATTLE), 1);
  assert.ok(bodyKin(APE, FOWL) < 1 && bodyKin(APE, FOWL) > bodyKin(APE, FISH));
  assert.ok(bodyKin(APE, FISH) <= 0.25);
  assert.ok(bodyKin(SWIMMER, FISH) > bodyKin(SWIMMER, CATTLE));
  for (const a of [APE, SWIMMER])
    for (const b of [CATTLE, FOWL, FISH, SWIMMER]) {
      const k = bodyKin(a, b);
      assert.ok(k >= 0.1 && k <= 1, `${k}`);
    }
});

test("the forces sum to the total, each raised by the roads; the crowd lets more crossings go on", () => {
  const f = ariseForces(LAND);
  assert.ok(Math.abs(f.herds + f.wild + f.crowds + f.marsh - f.total) < 1e-15);
  assert.ok(f.carried > 1 && f.goesOn > ARISE.goes && f.goesOn < 1);
  const city = ariseForces({ ...LAND, town: 400000, linked: 2e6 });
  assert.ok(city.total > f.total && city.crowds > f.crowds);
  assert.equal(leadingForce(city), "crowds");
  const lone = ariseForces({ ...LAND, roads: 0 });
  assert.equal(lone.carried, 1);
  assert.ok(lone.total < f.total);
});

test("no herds, no crossing from herds; herds of far kin cross the less, as the square of their kinship", () => {
  assert.equal(ariseForces({ ...LAND, herds: false }).herds, 0);
  const near = ariseForces(LAND).herds,
    far = ariseForces({ ...LAND, herdKin: 0.5 }).herds;
  assert.ok(Math.abs(far / near - 0.25) < 1e-9);
});

test("standing water breeds no sickness in the cold; drains halve it; a people of the water live in theirs", () => {
  assert.equal(ariseForces({ ...LAND, warmth: 10 }).marsh, 0);
  const warm = ariseForces(LAND).marsh;
  assert.ok(
    Math.abs(ariseForces({ ...LAND, clean: true }).marsh / warm - (1 - ARISE.clean)) < 1e-9,
  );
  assert.ok(
    ariseForces({ ...LAND, rain: 300, inWater: true }).marsh >
      ariseForces({ ...LAND, rain: 300 }).marsh,
  );
  assert.ok(lifePace(30) > lifePace(20) && lifePace(20) === 1 && lifePace(-40) >= 0.15);
});

test("hunters meet the wild's sicknesses: foragers more than sowers, an emptied wild none", () => {
  const sowers = ariseForces(LAND).wild,
    foragers = ariseForces({ ...LAND, hunt: 1 }).wild;
  assert.ok(foragers > sowers && sowers > 0);
  assert.equal(ariseForces({ ...LAND, hunt: 1, wild: 0 }).wild, 0);
  assert.equal(
    leadingForce(ariseForces({ ...LAND, herds: false, hunt: 1, warmth: 5, town: 0, linked: 0 })),
    "wild",
  );
});

test("a land of no one carries no hazard", () => {
  assert.equal(ariseForces({ ...LAND, people: 0, town: 0, linked: 0 }).total, 0);
});
