// Phase 55's blows, made and laid over every moment of a battle within a phone's frame: the limits
// are several times what the reference machine measures (made in ≈ 5 ms; a moment in ≈ 0.5 ms with
// the battle's own), so they catch a regression, not noise; the phone floor (an iPhone 15 Plus) is
// about half again slower. (npm test runs tests/perf alone, after the rest.)
import { test } from "node:test";
import assert from "node:assert/strict";
import type { BattleNear, BattleSideNear } from "../../src/bridge/index.ts";
import {
  BATTLE_LENGTH,
  battleAt,
  blowsAt,
  newBattle,
  newBlows,
  type BattleField,
} from "../../src/view/index.ts";

const side = (
  name: string,
  fielded: number,
  fallen: number,
  host: [arm: string, guard: string, mount: string],
  extra: Partial<BattleSideNear> = {},
): BattleSideNear => ({
  ref: `realm:${name}`,
  name: `the realm of ${name}`,
  color: [0.8, 0.2, 0.2],
  arms: null,
  fielded,
  fallen,
  host: { arm: host[0], guard: host[1], mount: host[2] },
  kit: `${host[0]}s`,
  ...extra,
});
const near = (a: BattleSideNear, d: BattleSideNear): BattleNear => ({
  event: `ev:0:field${a.fielded}`,
  war: "war:1",
  title: "The battle at the test land",
  cell: 1,
  land: "The test land",
  year: 100,
  attacker: a,
  defender: { ...d, color: [0.2, 0.3, 0.85] },
  won: true,
  outcome: "field",
  civil: null,
  hills: false,
  river: false,
  walls: 0,
  town: null,
  figure: null,
  plan: {
    seed: "test battle",
    ages: [
      { index: 0, from: 0, to: 0, kind: "quiet", seaLevel: 0, warmth: 0, forests: true },
    ] as never,
    lineages: [],
  },
});

test("the blows are made and laid over each moment fast enough for a phone", () => {
  const fields: BattleField[] = [
    // Axes against swords, history's wounded and maimed given; the later arms, cannon and all.
    newBattle(
      near(
        side("Ash", 900, 160, ["axe", "mail", ""], { wounded: 380, maimed: 30 }),
        side("Elm", 700, 220, ["sword", "shield", ""], { wounded: 300, maimed: 40 }),
      ),
      360,
    ),
    newBattle(
      near(
        side("Ash", 6000, 1500, ["automatic", "helmet", "armoured"], {
          cannon: true,
          wounded: 2000,
          maimed: 250,
        }),
        side("Elm", 4000, 1700, ["repeater", "plate", ""], {
          cannon: true,
          wounded: 2600,
          maimed: 300,
        }),
      ),
      360,
    ),
  ];
  for (const f of fields) {
    newBlows(f);
    let t = performance.now();
    const b = newBlows(f);
    assert.ok(performance.now() - t < 80, "made within 80 ms");
    t = performance.now();
    for (let s = 0; s <= BATTLE_LENGTH; s += 0.5) blowsAt(f, b, battleAt(f, s), "full");
    assert.ok(performance.now() - t < 1500, "301 moments within 1.5 s");
  }
});
