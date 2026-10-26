// The figures a battle is drawn as (Phase 55 M225): the bridge's battleFigures counts them as the field
// does (view/battle.ts newBattle), its wounded who live as the blows track draws them (view/blows.ts),
// and the refs a roll names round-trip. Each battle is checked at every most a side may be drawn as.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HURT_MOST,
  battleFigures,
  levyManRef,
  parseLevyManRef,
  parseTownsfolkRef,
  townsfolkRef,
  type BattleNear,
  type BattleOutcome,
  type BattleSideNear,
} from "../../src/bridge/index.ts";
import { newBattle } from "../../src/view/index.ts";

const side = (
  name: string,
  fielded: number,
  fallen: number,
  host: [string, string, string] | null,
  extra: Partial<BattleSideNear> = {},
): BattleSideNear => ({
  ref: `realm:${name}`,
  name: `the realm of ${name}`,
  color: [0.8, 0.2, 0.2],
  arms: null,
  fielded,
  fallen,
  host: host && { arm: host[0], guard: host[1], mount: host[2] },
  kit: host ? `${host[0]}s` : "spears, on foot",
  ...extra,
});

function near(
  outcome: BattleOutcome,
  a: BattleSideNear,
  d: BattleSideNear,
  ground: { hills?: boolean; river?: boolean; walls?: 0 | 1 | 2 } = {},
): BattleNear {
  return {
    event: `ev:0:${outcome}${a.fielded}`,
    war: "war:1",
    title: "The battle at the test land",
    cell: 1,
    land: "The test land",
    year: 100,
    attacker: a,
    defender: { ...d, color: [0.2, 0.3, 0.85] },
    won: outcome !== "held",
    outcome,
    civil: null,
    hills: ground.hills ?? false,
    river: ground.river ?? false,
    walls: ground.walls ?? 0,
    town: ground.walls ? "Testholt" : null,
    figure: null,
    plan: {
      seed: "test battle",
      ages: [
        { index: 0, from: 0, to: 0, kind: "quiet", seaLevel: 0, warmth: 0, forests: true },
      ] as never,
      lineages: [],
    },
  };
}

/** The most a side is drawn as: the phone's and the full detail's, and the one between. */
const MOSTS = [120, 240, 360] as const;

/** The battles the figures are checked on, each as its hosts fought it. */
const CASES: readonly [string, BattleNear][] = [
  [
    "a field of spears",
    near(
      "field",
      side("Ash", 900, 120, ["spear", "shield", ""]),
      side("Elm", 700, 160, ["spear", "shield", ""]),
    ),
  ],
  [
    "held on hills",
    near(
      "held",
      side("Ash", 2400, 400, ["bow", "shield", ""]),
      side("Elm", 1800, 200, ["sword", "mail", ""]),
      { hills: true },
    ),
  ],
  [
    "stormed at stone walls",
    near(
      "stormed",
      side("Ash", 3000, 500, ["axe", "hide", ""]),
      side("Elm", 800, 700, ["spear", "shield", ""]),
      { walls: 2 },
    ),
  ],
  [
    "a field of many",
    near(
      "field",
      side("Ash", 10463, 1853, ["rifle", "plate", ""], { cannon: true }),
      side("Elm", 9000, 900, ["musket", "mail", ""], { cannon: true }),
    ),
  ],
  [
    "held, the few",
    near(
      "held",
      side("Ash", 30, 25, ["spear", "shield", ""]),
      side("Elm", 25, 3, ["spear", "shield", ""]),
    ),
  ],
  [
    "taken, the attackers unhurt",
    near(
      "taken",
      side("Ash", 400, 0, ["spear", "shield", ""]),
      side("Elm", 380, 120, ["spear", "shield", ""]),
    ),
  ],
];

/** The wounded a side is given in the checks: none, three for each of its fallen, the rest of its men. */
const woundsOf = (s: BattleSideNear): readonly number[] => [0, 3 * s.fallen, s.fielded - s.fallen];

test("battleFigures is the field's rule", () => {
  for (const [name, battle] of CASES)
    for (const most of MOSTS) {
      const field = newBattle(battle, most),
        f = battleFigures(battle, most);
      assert.equal(f.per, field.per, `${name}, most ${most}`);
      for (const i of [0, 1] as const) {
        assert.equal(f.sides[i].n, field.hosts[i].n, `${name}, most ${most}, side ${i}`);
        assert.equal(f.sides[i].falls, field.hosts[i].falls, `${name}, most ${most}, side ${i}`);
      }
    }
});

test("the wounded who live: so many figures for so many men, at most HURT_MOST of those standing", () => {
  for (const [name, battle] of CASES)
    for (const most of MOSTS) {
      // A side with no wounded record gives no wounded figures.
      const bare = battleFigures(battle, most);
      assert.equal(bare.sides[0].hurt, 0, `${name}, most ${most}`);
      assert.equal(bare.sides[1].hurt, 0, `${name}, most ${most}`);
      for (const wa of woundsOf(battle.attacker))
        for (const wd of woundsOf(battle.defender)) {
          const hit: BattleNear = {
              ...battle,
              attacker: { ...battle.attacker, wounded: wa },
              defender: { ...battle.defender, wounded: wd },
            },
            f = battleFigures(hit, most),
            wounded = [wa, wd] as const;
          for (const i of [0, 1] as const) {
            const s = f.sides[i],
              w = wounded[i],
              standing = s.n - s.falls,
              where = `${name}, most ${most}, side ${i}, wounded ${w}`;
            assert.equal(
              s.hurt,
              w > 0 ? Math.min(Math.floor(HURT_MOST * standing), Math.round(w / f.per)) : 0,
              where,
            );
            assert.equal(s.stood, standing - s.hurt, where);
            assert.ok(s.stood >= 0, where);
            if (standing >= 1) assert.ok(s.stood >= 1, where);
          }
        }
    }
});

test("the refs round-trip", () => {
  assert.deepEqual(parseTownsfolkRef(townsfolkRef("town:0:43", 7, 33)), {
    town: "town:0:43",
    line: 7,
    n: 33,
  });
  assert.deepEqual(parseTownsfolkRef("folk:town:0:43:7"), {
    town: "town:0:43",
    line: 7,
    n: null,
  });
  assert.equal(parseTownsfolkRef("folk:0:12"), null);
  assert.equal(parseTownsfolkRef("folk:town:0:43"), null);
  assert.deepEqual(parseLevyManRef(levyManRef("ev:0:123", 1, 65537)), {
    event: "ev:0:123",
    side: 1,
    j: 65537,
  });
  assert.equal(parseLevyManRef("lv:ev:0:1:2:5"), null);
});
