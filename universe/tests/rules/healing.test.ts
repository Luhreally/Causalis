// Phase 55 M229 (T40): a wound's days abed and mending, who tends it, who is borne home.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LETHAL,
  borneHome,
  healDays,
  tendedBy,
  type Blow,
  type Member,
  type Outcome,
  type Tended,
} from "../../src/rules/index.ts";

const BLOWS = Object.keys(LETHAL) as Blow[];
const OUTCOMES: readonly Outcome[] = ["healed", "scarred", "lame", "lost"];
// (One member of each kind a lost one is told by: an eye, a hand, a leg, an arm.)
const KINDS: readonly Member[] = ["eye-l", "hand-r", "leg-l", "arm-r"];
const TENDED: readonly Tended[] = ["hospital", "healer", "household", "kin"];

test("days by what came of it", () => {
  assert.deepEqual(healDays("healed", "arm-l", "edge", 0, "household"), { abed: 2, mending: 12 });
  // (21·1.4·1.1 = 32.34; 42·1.54 = 64.68.)
  assert.deepEqual(healDays("lost", "leg-r", "fire", 0, "kin"), { abed: 32, mending: 65 });
});

test("care and tending shorten them", () => {
  for (const outcome of OUTCOMES)
    for (const member of KINDS)
      for (const blow of BLOWS) {
        let last = healDays(outcome, member, blow, 0, "kin");
        for (const care of [0.25, 0.5, 1]) {
          const d = healDays(outcome, member, blow, care, "kin");
          assert.ok(
            d.abed <= last.abed && d.mending <= last.mending,
            `${outcome} ${member} ${blow}`,
          );
          last = d;
        }
        for (const care of [0, 0.5, 1]) {
          const days = TENDED.map((t) => healDays(outcome, member, blow, care, t));
          for (let k = 1; k < days.length; k++) {
            assert.ok(days[k - 1]!.abed <= days[k]!.abed, `${TENDED[k - 1]} before ${TENDED[k]}`);
            assert.ok(days[k - 1]!.mending <= days[k]!.mending);
          }
          for (const d of days) assert.ok(d.abed >= 1 && d.mending >= 1);
        }
      }
});

test("who tends", () => {
  for (const hospital of [true, false])
    for (const healer of [true, false])
      for (const household of [true, false])
        assert.equal(
          tendedBy(hospital, healer, household),
          hospital ? "hospital" : healer ? "healer" : household ? "household" : "kin",
        );
});

test("who is borne", () => {
  assert.equal(borneHome(0.35, "arm-l", "scarred", true), true);
  assert.equal(borneHome(0.2, "arm-l", "lame", true), false);
  assert.equal(borneHome(0.2, "leg-r", "lost", true), true);
  assert.equal(borneHome(0.2, "leg-r", "healed", true), false);
  assert.equal(borneHome(1, "leg-r", "lost", false), false);
});
