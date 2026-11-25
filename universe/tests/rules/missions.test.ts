import { test } from "node:test";
import assert from "node:assert/strict";
import { MISSION, missionChance, missionWorth, preachersFor } from "../../src/rules/index.ts";

// Missionaries (rules/missions.ts): sent where a land's people would come to give more than keeping preachers there costs.

test("a land that holds a faith is won less readily than one of the old beliefs, and the devout win more", () => {
  assert.ok(missionChance(true, 0.6) < missionChance(false, 0.6));
  assert.ok(missionChance(false, 0.9) > missionChance(false, 0.3));
  assert.ok(Math.abs(missionChance(true, 0.5) - MISSION.base * MISSION.held) < 1e-12);
});

test("as many are sent as open a land, never fewer than two, and they are kept for the mission's years", () => {
  assert.equal(preachersFor(100), MISSION.fewest);
  assert.equal(preachersFor(100_000), 40);
  const w = missionWorth(100_000, false, 0.6, 0.5);
  assert.equal(w.cost, 40 * MISSION.keep * MISSION.years);
  assert.ok(w.won > 0 && w.won < 1);
});

test("a mission is worth it to many who would give much, and not to a few or to those who give nothing", () => {
  const many = missionWorth(100_000, false, 0.6, 0.5);
  assert.ok(many.worth > many.cost);
  const few = missionWorth(300, true, 0.6, 0.05);
  assert.ok(few.worth < few.cost);
  assert.equal(missionWorth(100_000, false, 0.6, 0).worth, 0);
});
