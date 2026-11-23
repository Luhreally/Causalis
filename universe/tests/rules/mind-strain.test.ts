import { test } from "node:test";
import assert from "node:assert/strict";
import { STRAIN, landStrainOf, mindOf, mindShowsOf, selfNature } from "../../src/rules/index.ts";

// 2026-11-22, the audit's "mental health": what the world did to someone (wounds, bondage, no roof, idle hands) weighs with the
// rest; how it shows in what they do once it wears on them, and which way is their temper and what weighs; and the same reckoning
// over a land's people as one number, which costs its crafts.

const nature = selfNature(null),
  middle = { boldness: 0.5, warmth: 0.5, temper: 0.5, conscience: 0.5, curiosity: 0.5, drive: 0.5 },
  quiet = {
    nature,
    traits: middle,
    child: false,
    lost: 0,
    mourning: false,
    dangerYoung: 0,
    dangerGrown: 0,
    dangerNow: 0,
    hungerYoung: 0,
    hungerGrown: 0,
    fed: 1,
    left: 1,
    standing: 0.5,
    caste: 0.2,
    barred: false,
    partners: 1,
    young: 1,
    parents: false,
    faith: false,
    piety: 0.5,
  };

test("what the world did to them weighs: a member lost, bondage, no roof, idle hands", () => {
  const base = mindOf(quiet);
  assert.ok(mindOf({ ...quiet, wounds: 1 }).weights.war > base.weights.war + 0.3);
  assert.ok(mindOf({ ...quiet, bound: true }).weights.place > base.weights.place + 0.3);
  assert.ok(mindOf({ ...quiet, roofless: true }).weights.place > base.weights.place + 0.2);
  assert.ok(mindOf({ ...quiet, idle: true }).weights.want > base.weights.want + 0.15);
  // (A child's idle hands are no one's want.)
  assert.equal(
    mindOf({ ...quiet, child: true, idle: true }).weights.want,
    mindOf({ ...quiet, child: true }).weights.want,
  );
});

test("it shows only once it wears on them; the quick to anger cannot settle, the warm bowed by a death draw in", () => {
  assert.equal(mindShowsOf(mindOf(quiet), middle), 0);
  const grief = mindOf({ ...quiet, mourning: true, lost: 3, bound: true, partners: 0, young: 0 });
  assert.ok(grief.burden >= 0.3, `burden ${grief.burden}`);
  assert.equal(mindShowsOf(grief, { ...middle, warmth: 0.9, temper: 0.3 }), 1);
  const war = mindOf({
      ...quiet,
      wounds: 1,
      dangerGrown: 1,
      dangerNow: 1,
      fed: 0.6,
      partners: 0,
      young: 0,
    }),
    hot = { ...middle, temper: 0.85, boldness: 0.7 };
  assert.ok(war.burden >= 0.3, `burden ${war.burden}`);
  assert.equal(mindShowsOf(war, hot), 2);
});

test("a land's strain: the dead past the usual, a foe, want, bondage; less where it is cared for; a hive bears a death as one", () => {
  const calm = {
    nature,
    deaths: 0.02,
    usual: 0.02,
    occupied: false,
    fed: 1,
    idle: 0,
    bound: 0,
    street: 0,
    care: 0,
    clergy: 0,
  };
  assert.ok(landStrainOf(calm).strain < 0.01);
  const plague = landStrainOf({ ...calm, deaths: 0.04 });
  assert.ok(plague.weights.loss > 0.3, `loss ${plague.weights.loss}`);
  assert.ok(landStrainOf({ ...calm, deaths: 0.04, care: 1, clergy: 1 }).strain < plague.strain);
  assert.ok(landStrainOf({ ...calm, occupied: true }).weights.war > 0.3);
  assert.ok(landStrainOf({ ...calm, bound: 0.5 }).weights.place >= 0.2);
  const hive = landStrainOf({ ...calm, deaths: 0.04, nature: { ...nature, hive: true } });
  assert.ok(hive.weights.loss < plague.weights.loss / 2);
  // (What it costs: never past STRAIN.work of a land's crafts.)
  assert.ok(STRAIN.work > 0 && STRAIN.work <= 0.1);
});
