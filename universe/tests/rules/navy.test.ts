// Fleets built and worn, the sea fought for by Lanchester's square, hosts carried over it, and blockades (rules/navy.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NAVY,
  TON_YEAR,
  blockadeOf,
  fleetYear,
  hullQuality,
  landingShare,
  navyWanted,
  seaBattle,
  seaCarried,
} from "../../src/rules/index.ts";

test("a fleet twice the other's, as good, commands four fifths of the sea, and loses less", () => {
  const s = seaBattle(2000, 1, 1000, 1);
  assert.ok(Math.abs(s.command[0] - 0.8) < 1e-9, `${s.command[0]}`);
  assert.ok(s.sunk[0] < s.sunk[1]);
  // (Quality counts as tonnes squared: four times as good is as strong as twice as many.)
  const q = seaBattle(1000, 4, 2000, 1);
  assert.ok(Math.abs(q.command[0] - 0.5) < 1e-9);
});

test("a side with no fleet commands nothing and loses nothing; with none on either side, no one commands", () => {
  const s = seaBattle(500, 1, 0, 1);
  assert.deepEqual(s.command, [1, 0]);
  assert.deepEqual(s.sunk, [0, 0]);
  assert.deepEqual(seaBattle(0, 1, 0, 1).command, [0, 0]);
});

test("a fleet is built toward what is wanted as fast as its wrights allow, and wears out", () => {
  const grown = fleetYear(0, 10_000, 3000);
  assert.equal(grown.built, 3000);
  assert.equal(grown.tons, 3000);
  const kept = fleetYear(10_000, 10_000, 0);
  assert.ok(Math.abs(kept.tons - 10_000 * (1 - 1 / NAVY.life)) < 1e-6);
  // (More than it wants is laid up, a little each year; too little to sail is none.)
  assert.ok(fleetYear(10_000, 0, 0).tons < 10_000 * (1 - 1 / NAVY.life));
  assert.equal(fleetYear(5, 0, 0).tons, 0);
});

test("a realm on the sea keeps more ships than one barely on it, more at war across it, and matches a feared rival", () => {
  const base = { made: 1_000_000, worth: 30, coast: 0.2, atSea: false, footing: 0, rival: 0 };
  const little = navyWanted(base),
    much = navyWanted({ ...base, coast: 0.9 }),
    war = navyWanted({ ...base, atSea: true });
  assert.ok(much > little && war > little);
  assert.ok(Math.abs(little - (0.2 * NAVY.peace * 1_000_000) / (TON_YEAR * 30)) < 1e-6);
  assert.ok(navyWanted({ ...base, rival: 10_000 }) >= 10_000 * NAVY.match - 1e-6);
  // (Never more than it can bear.)
  const most = (NAVY.most * 1_000_000) / (TON_YEAR * 30);
  assert.ok(navyWanted({ ...base, rival: 1e9 }) <= most + 1e-6);
});

test("an even sea lands a carried host as the old landing did; holding the sea lands it better, losing it worse", () => {
  assert.ok(Math.abs(landingShare(0.5, 1) - 0.6) < 1e-9);
  assert.ok(landingShare(1, 1) > landingShare(0.5, 1));
  assert.ok(landingShare(0, 1) < landingShare(0.5, 1));
  assert.ok(landingShare(0.5, 0) < landingShare(0.5, 1));
  assert.equal(seaCarried(2000, 0, 1000), 1);
  assert.equal(seaCarried(500, 500, 1000), 0.5);
});

test("a blockade closes nothing up to an even sea and everything at its full command", () => {
  assert.equal(blockadeOf(0.5), 0);
  assert.equal(blockadeOf(1), 1);
  assert.ok(Math.abs(blockadeOf(0.75) - 0.5) < 1e-9);
});

test("a tonne is worth more with better arms, more fire, and ships that go farther", () => {
  assert.ok(hullQuality(2, 0, 4) > hullQuality(1, 0, 4));
  assert.ok(hullQuality(1, 1, 4) > hullQuality(1, 0, 4));
  assert.ok(hullQuality(1, 0, 16) > hullQuality(1, 0, 2));
});
