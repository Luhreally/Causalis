import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_MONTHS, LEVEL } from "../../src/rules/index.ts";
import {
  HEART_BLOCKS,
  QUARTER,
  groundWealth,
  homeGround,
  quarterOf,
  rankSteep,
  shareWords,
  type TownPlan,
  type TownRank,
  type TownSite,
} from "../../src/bridge/index.ts";
import { TownParts, townCivics, townHomes, townScene } from "../../src/view/index.ts";

// Asked 2026-11-17: "can you make it so the leaders houses and the rich houses look notably different". A town's homes are
// told apart by who holds them only where its land's wealth is held unevenly, the more the steeper; a great house's hall, a
// key figure's home and the ruler's seat each stand marked; an even land's town is drawn exactly as it was.

const YEAR_S = 365 * 86_400,
  AT = 60 * YEAR_S;
const SITE: TownSite = {
  up: 0.6,
  rise: 14,
  lee: 2.4,
  roads: [{ bearing: 0.3, busy: 4, rails: false, to: 1 }],
  measured: -1,
  walled: null,
  dry: false,
};
const town = (rank?: TownRank, more: Partial<TownPlan> = {}): TownPlan => ({
  family: "grid",
  site: SITE,
  ...(rank ? { rank } : {}),
  seed: 11,
  axis: 0.3,
  lots: 800,
  whole: 800,
  runs: [[0, 0, 800, 10, 10, LEVEL.house, -1]],
  civics: [],
  walls: null,
  months: HOME_MONTHS,
  designs: [{ since: -1, walls: "timber", roof: "thatch", form: "square", pitch: 40 }],
  paved: false,
  water: null,
  year: 60,
  ...more,
});
/** A town's homes drawn: its parts, and how many. */
function homes(plan: TownPlan, which?: number[]) {
  const scene = townScene(plan, AT),
    out = new TownParts();
  townHomes(scene, which ?? Array.from({ length: plan.lots }, (_, p) => p), AT, out);
  return out;
}
const colours = (out: TownParts) => out.groups.size;

test("the ground wealth sorts a town's homes onto: none in an even land, the heart and the high ground before engines, the high edge after", () => {
  assert.equal(homeGround(11, 3, 800, 1, 0.2, false), null);
  assert.equal(homeGround(11, 3, 800, 1, 0.5, false), "heart");
  let high = -1,
    lee = -1,
    highEdge = -1;
  for (let b = HEART_BLOCKS; b < 100; b++) {
    if (high < 0 && b < 24 && quarterOf(11, b) === QUARTER.high) high = b;
    if (b >= 50 && quarterOf(11, b) === QUARTER.lee) lee = b;
    if (b >= 50 && quarterOf(11, b) === QUARTER.high) highEdge = b;
  }
  assert.equal(homeGround(11, high * 8, 800, 1, 0.5, false), "high");
  assert.equal(homeGround(11, lee * 8, 800, 1, 0.5, false), "lee-edge");
  assert.equal(homeGround(11, highEdge * 8, 800, 1, 0.5, true), "high-edge");
  assert.equal(homeGround(11, 3, 800, 3, 0.5, true), "tall-heart");
  assert.deepEqual(
    (["heart", "high-edge", "lee-edge", "tall-heart", null] as const).map(groundWealth),
    [1, 1, -1, -1, 0],
  );
  assert.ok(rankSteep(0.3) < rankSteep(0.45) && rankSteep(0.7) === 1);
  assert.equal(shareWords(0.2), "a fifth");
});

test("an even land's town is drawn as it was; an uneven one's well-off and poor homes are told apart, the more the steeper", () => {
  const plain = homes(town()),
    even = homes(town({ gini: 0.15, drives: false })),
    uneven = homes(town({ gini: 0.4, drives: false })),
    steep = homes(town({ gini: 0.65, drives: false }));
  assert.equal(even.count, plain.count, "an even land adds nothing");
  assert.equal(colours(even), colours(plain));
  assert.ok(uneven.count > plain.count, "gardens, porches, lean-tos");
  // (No more than a handful of colours more: the same meshes, a few batches.)
  assert.ok(colours(uneven) - colours(plain) <= 8, `${colours(uneven) - colours(plain)} colours`);
  // A well-off home stands taller than a poor one, the more so the steeper the land.
  let lee = -1;
  for (let b = 50; b < 100 && lee < 0; b++) if (quarterOf(11, b) === QUARTER.lee) lee = b * 8;
  const top = (out: TownParts) => {
    let y = 0;
    for (const g of out.groups.values())
      if (g.mesh === "box" && !g.lamp)
        for (let i = 0; i < g.data.length; i += 7)
          if (g.data[i + 3]! > 3) y = Math.max(y, g.data[i + 1]! + g.data[i + 4]! / 2);
    return y;
  };
  const gap = (gini: number) => {
    const plan = town({ gini, drives: false });
    return top(homes(plan, [3])) - top(homes(plan, [lee]));
  };
  assert.ok(gap(0.4) > 0.5, `${gap(0.4)} m`);
  assert.ok(gap(0.65) > gap(0.4));
  assert.ok(steep.count >= uneven.count);
});

test("a great house's hall stands over its neighbours in its colours; a key figure's home is marked", () => {
  const color = [0.9, 0.2, 0.7] as const,
    rank: TownRank = {
      gini: 0.2,
      drives: false,
      halls: [{ lot: 5, name: "Varro", color, share: 0.2 }],
      marks: [{ lot: 9, ref: "court:x", name: "A B", title: "Voice of the smiths" }],
    },
    plan = town(rank),
    hall = homes(plan, [5]),
    marked = homes(plan, [9]),
    plainOne = homes(town(), [5]);
  const key = `|${color[0].toFixed(3)}|${color[1].toFixed(3)}|${color[2].toFixed(3)}`;
  assert.ok(
    [...hall.groups.keys()].some((k) => k.endsWith(key)),
    "its colour flown",
  );
  assert.ok(hall.count >= plainOne.count + 8, "its tower, its yard's wall, its banner");
  assert.ok(marked.count > plainOne.count, "a pennant at the door");
});

test("a seat's hall is a palace: its forecourt, banners and guards; a keep on an older realm's, wings on a great one's", () => {
  const civic = { kind: "hall" as const, at: 8, lots: 8, start: 20, end: 23, fell: null },
    drawn = (grade?: 0 | 1 | 2) => {
      const plan = town(
          grade === undefined
            ? { gini: 0, drives: false }
            : {
                gini: 0,
                drives: false,
                seat: {
                  realm: "pol:0:1",
                  name: "X",
                  ruler: "rule:pol:0:1",
                  color: [0.2, 0.4, 0.9],
                  grade,
                },
              },
          { civics: [civic] },
        ),
        out = new TownParts();
      townCivics(townScene(plan, AT), AT, out);
      return out.count;
    };
  assert.ok(drawn(0) > drawn(), "a seat's hall is dressed");
  assert.ok(drawn(1) > drawn(0), "a keep");
  assert.ok(drawn(2) > drawn(1), "wings");
});
