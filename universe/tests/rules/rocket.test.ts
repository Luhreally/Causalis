// War past the line, W3: a rocket's numbers read off its world. Earth's first some 300 km, far past that in stages; a heavy
// world's never worth making; a small light world's around it; a wide miss wastes one load, and a steered one does not.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LEAST_THROW_KM,
  aroundKm,
  firstRocket,
  landsAt,
  lotsPerRocket,
  meansWorldOf,
  rocketMiss,
  rocketOn,
  rowReadings,
  speedToLand,
  stagesKnown,
  throwOf,
} from "../../src/rules/index.ts";
import { SOLAR } from "../../src/rules/chemistry.ts";

const ground = (pull: number, radius: number, airBar = 1, kelvin = 288) => ({
  pull,
  radius,
  airBar,
  kelvin,
});
const EARTH = ground(1, 1);

test("the ballistic sum: g × range when short, orbit's speed half way round, and it turns about", () => {
  assert.ok(Math.abs(speedToLand(EARTH, 100) - Math.sqrt(9.81 * 100_000)) < 15);
  assert.ok(Math.abs(speedToLand(EARTH, aroundKm(EARTH)) - 7905) < 10);
  for (const km of [50, 300, 2000, 9000])
    assert.ok(Math.abs(landsAt(EARTH, speedToLand(EARTH, km)) - km) < 1);
  assert.equal(landsAt(EARTH, 9000), aroundKm(EARTH));
});

test("Earth's first lands some 300 km, and far past that in stages", () => {
  const one = rocketOn(EARTH, 4.2, 1),
    two = rocketOn(EARTH, 4.2, 2),
    three = rocketOn(EARTH, 4.2, 3);
  assert.ok(one.reachKm > 250 && one.reachKm < 350, `${one.reachKm}`);
  assert.ok(two.reachKm > 1200, `${two.reachKm}`);
  assert.ok(three.reachKm > 2200, `${three.reachKm}`);
  assert.ok(one.thrown > 1900 && one.thrown < 2200, `${one.thrown}`);
  assert.equal(one.loadKg, 1000);
});

test("a heavy world's is never worth making; a weak charge's neither; a small light world's goes around it", () => {
  assert.equal(firstRocket(ground(2.6, 1.4), 4.2), null);
  assert.equal(firstRocket(ground(1.3, 1.1), 1.58), null);
  assert.equal(firstRocket(EARTH, null), null);
  assert.ok((firstRocket(EARTH, 4.2)?.reachKm ?? 0) >= LEAST_THROW_KM);
  assert.ok(rocketOn(ground(0.15, 0.3), 4.2, 1).around);
  assert.ok(!rocketOn(EARTH, 4.2, 3).around);
});

test("stages come with what steers it, then what reaches orbit", () => {
  const with_ = (...ids: string[]) => stagesKnown((id) => ids.includes(id));
  assert.equal(with_(), 1);
  assert.equal(with_("guidance"), 2);
  assert.equal(with_("guidance", "orbital-flight"), 3);
  assert.equal(with_("orbital-flight"), 1);
});

test("a wide miss wastes a load, and a steered one lands: the same town, the same 100 rockets", () => {
  const at = { rockets: 100, mjPerKg: 4.2, lots: 2000, people: 8000 },
    wide = throwOf({ ...at, miss: rocketMiss(300, false) }),
    steered = throwOf({ ...at, miss: rocketMiss(300, true) });
  assert.equal(rocketMiss(300, false), 9000);
  assert.equal(rocketMiss(300, true), 150);
  assert.ok(wide.landed < 1, `${wide.landed}`);
  assert.equal(wide.share, 0);
  assert.equal(wide.dead, 0);
  assert.ok(steered.landed > 90, `${steered.landed}`);
  assert.ok(steered.flattened > 200, `${steered.flattened}`);
  assert.ok(steered.dead > 50, `${steered.dead}`);
  // (Energy to the 2/3 power: ten times a drop's load flattens 4.6 of a drop's lots.)
  assert.ok(Math.abs(lotsPerRocket(4.2) - 4.64) < 0.02);
});

test("the page says what it does and what shuts it, in words true both ways", () => {
  const read = (gravity: number, radius: number, medium: "land" | "water" = "land") =>
    rowReadings({
      chem: SOLAR,
      means: meansWorldOf({
        chem: SOLAR,
        kind: "rocky",
        celsius: 15,
        gravity,
        radius,
        medium,
        bodyFire: true,
        insolation: 1,
      }),
    }).find((r) => r.id === "throw-far")!;
  const open = read(1, 1),
    heavy = read(2.6, 1.4),
    sea = read(1, 1, "water");
  assert.ok(open.met);
  assert.match(open.why, /lands 3\d\d km away/);
  assert.ok(!heavy.met);
  assert.match(heavy.why, /Its pull takes nearly all/);
  assert.ok(!sea.met);
  assert.match(sea.why, /seas/);
  assert.match(read(0.15, 0.3).why, /anywhere on its world/);
});
