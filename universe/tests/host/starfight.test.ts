// The pure parts of the fights among the stars (Phase 67): the drives a strength and a speed ask,
// how a fight ranks and which is best to watch, and how a ship's ref reads back. The far-save
// checks live in the scratch probe, not here.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bestFight,
  driveOfSpeed,
  driveOfStrength,
  fightRank,
  parseShipRef,
} from "../../src/host/starfight.ts";
import type { StarFightEntry } from "../../src/bridge/index.ts";

const row = (
  id: string,
  town: string | null,
  strength: number,
  defence: number,
  year = 1757,
): StarFightEntry => ({
  id,
  road: "raid",
  year,
  attacker: "the Kregraanok",
  defender: "Shisten",
  attackerColor: [0, 0, 0],
  defenderColor: [0, 0, 0],
  won: true,
  strength,
  defence,
  dead: 0,
  town,
  ships: true,
  claim: "",
  page: id,
});

test("a drive follows the strength of a realm and the speed of a people", () => {
  assert.equal(driveOfStrength(2.46), "fusion");
  assert.equal(driveOfStrength(3), "sail");
  assert.equal(driveOfStrength(5), "antimatter");
  assert.equal(driveOfSpeed(0.05), "fusion");
  assert.equal(driveOfSpeed(0.2), "sail");
  assert.equal(driveOfSpeed(0.3), "antimatter");
});

test("a fight on a town outranks one at sea, and an even fight outranks a lopsided one", () => {
  const a = fightRank({ town: "x", ships: true, strength: 5.2, defence: 5 });
  const b = fightRank({ town: "x", ships: true, strength: 5.5, defence: 2.7 });
  const c = fightRank({ town: null, ships: true, strength: 5, defence: 5 });
  assert.ok(a > b, `${a} > ${b}`);
  assert.ok(b > c, `${b} > ${c}`);
});

test("the best fight is the highest rank, the later year on a tie, the earlier row otherwise", () => {
  const rows = [row("ev:a", "x", 5.2, 5), row("ev:b", "x", 5.5, 2.7), row("ev:c", null, 5, 5)];
  assert.equal(bestFight(rows), "ev:a");
  assert.equal(bestFight([]), null);
  assert.equal(
    bestFight([row("ev:old", "x", 5, 5, 1000), row("ev:new", "x", 5, 5, 1100)]),
    "ev:new",
  );
  assert.equal(
    bestFight([row("ev:first", "x", 5, 5, 1100), row("ev:second", "x", 5, 5, 1100)]),
    "ev:first",
  );
});

test("a ship's ref reads back into its fight, side, index, class, state and name", () => {
  assert.deepEqual(parseShipRef("ship:ev.0.364215:0:3:1:1:Talmirn"), {
    fight: "ev.0.364215",
    side: 0,
    index: 3,
    cls: 1,
    broke: true,
    name: "Talmirn",
  });
  assert.equal(parseShipRef("ship:x"), null);
});
